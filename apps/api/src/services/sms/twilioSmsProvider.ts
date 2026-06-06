import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import type { SmsMessageType, SmsSendResult } from "rapid-cortex-shared";
import { redactE164Phone } from "rapid-cortex-shared";

const sm = new SecretsManagerClient({});

type TwilioSecretLegacy = {
  accountSid: string;
  authToken: string;
  /** Required unless `messagingServiceSid` is set (A2P / Messaging Service send). */
  fromE164?: string;
  messagingServiceSid?: string;
};

type TwilioSecretApiKey = {
  accountSid: string;
  apiKeySid: string;
  apiKeySecret: string;
  messagingServiceSid: string;
};

/** Exposed for tests and failover rules. */
export function classifyTwilioHttpResponse(status: number, body: string): { retryable: boolean } {
  if (status === 429) return { retryable: true };
  if (status >= 500) return { retryable: true };
  if (body.toLowerCase().includes("timeout")) return { retryable: true };
  if (status === 400 || status === 404) return { retryable: false };
  return { retryable: false };
}

export async function loadTwilioSecret(secretArn: string): Promise<TwilioSecretLegacy | TwilioSecretApiKey | null> {
  if (!secretArn.trim()) return null;
  const out = await sm.send(new GetSecretValueCommand({ SecretId: secretArn.trim() }));
  const raw = out.SecretString;
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof j.accountSid === "string" &&
      typeof j.apiKeySid === "string" &&
      typeof j.apiKeySecret === "string" &&
      typeof j.messagingServiceSid === "string"
    ) {
      return j as TwilioSecretApiKey;
    }
    if (typeof j.accountSid === "string" && typeof j.authToken === "string") {
      const legacy = j as TwilioSecretLegacy;
      if (typeof legacy.messagingServiceSid === "string" && legacy.messagingServiceSid.length > 0) {
        return legacy;
      }
      if (typeof legacy.fromE164 === "string" && legacy.fromE164.length > 0) {
        return legacy;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Twilio REST API (Messaging Service or legacy From number). Credentials from Secrets Manager only.
 */
export async function sendWithTwilio(args: {
  secretArn: string;
  toPhoneE164: string;
  messageBody: string;
  agencyId: string;
  incidentId: string;
  messageType: SmsMessageType;
}): Promise<SmsSendResult> {
  const sentAt = new Date().toISOString();
  const recipientRedacted = redactE164Phone(args.toPhoneE164);

  const creds = await loadTwilioSecret(args.secretArn);
  if (!creds) {
    return {
      provider: "twilio",
      status: "failed",
      errorCode: "TWILIO_SECRET_INVALID",
      errorMessage: "Twilio secret missing or JSON shape invalid",
      recipientRedacted,
      sentAt,
      retryable: false,
    };
  }

  const body = new URLSearchParams({ To: args.toPhoneE164, Body: args.messageBody });
  let authHeader: string;
  let url: string;

  if ("apiKeySid" in creds) {
    body.set("MessagingServiceSid", creds.messagingServiceSid);
    authHeader = `Basic ${Buffer.from(`${creds.apiKeySid}:${creds.apiKeySecret}`, "utf8").toString("base64")}`;
    url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(creds.accountSid)}/Messages.json`;
  } else {
    if (creds.messagingServiceSid) {
      body.set("MessagingServiceSid", creds.messagingServiceSid);
    } else if (creds.fromE164) {
      body.set("From", creds.fromE164);
    } else {
      return {
        provider: "twilio",
        status: "failed",
        errorCode: "TWILIO_FROM_OR_SERVICE_REQUIRED",
        errorMessage: "Twilio secret must include messagingServiceSid or fromE164",
        recipientRedacted,
        sentAt,
        retryable: false,
      };
    }
    authHeader = `Basic ${Buffer.from(`${creds.accountSid}:${creds.authToken}`, "utf8").toString("base64")}`;
    url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(creds.accountSid)}/Messages.json`;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const text = await res.text();
    if (!res.ok) {
      const { retryable } = classifyTwilioHttpResponse(res.status, text);
      console.error(
        JSON.stringify({
          type: "outbound.sms",
          provider: "twilio",
          outcome: "failed",
          messageType: args.messageType,
          agencyId: args.agencyId,
          incidentId: args.incidentId,
          destinationMasked: recipientRedacted,
          httpStatus: res.status,
          retryable,
        }),
      );
      return {
        provider: "twilio",
        status: "failed",
        errorCode: `HTTP_${res.status}`,
        errorMessage: text.slice(0, 500),
        recipientRedacted,
        sentAt,
        retryable,
      };
    }
    let sid: string | undefined;
    try {
      const j = JSON.parse(text) as { sid?: string };
      sid = typeof j.sid === "string" ? j.sid : undefined;
    } catch {
      sid = undefined;
    }
    console.info(
      JSON.stringify({
        type: "outbound.sms",
        provider: "twilio",
        outcome: "sent",
        messageType: args.messageType,
        agencyId: args.agencyId,
        incidentId: args.incidentId,
        destinationMasked: recipientRedacted,
        messageId: sid ?? null,
      }),
    );
    return {
      provider: "twilio",
      status: "sent",
      messageId: sid,
      recipientRedacted,
      sentAt,
      retryable: false,
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      provider: "twilio",
      status: "failed",
      errorCode: "NETWORK",
      errorMessage: message.slice(0, 500),
      recipientRedacted,
      sentAt,
      retryable: true,
    };
  }
}
