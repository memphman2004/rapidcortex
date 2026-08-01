import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../lib/env.js";
import { loadTwilioSecret } from "../../services/sms/twilioSmsProvider.js";

/**
 * Twilio delivery receipts. Without this webhook a Twilio 201 is the last signal we get, so a
 * carrier-filtered message (30007) or unregistered A2P campaign (30034) looks identical to a
 * delivered one in CloudWatch.
 *
 * Log-only by design: nothing is persisted and no tenant data is read, so there is no agencyId
 * to scope. Recipient number and message body are never logged.
 */

const TERMINAL_FAILURE_STATUSES = new Set(["undelivered", "failed"]);

/**
 * Twilio signs `url + <sorted key><value>...` with the account auth token.
 * Secrets using the API-key shape carry no auth token, so signature checks are unavailable —
 * see `verifySignature`.
 */
function expectedSignature(authToken: string, url: string, params: URLSearchParams): string {
  let payload = url;
  for (const key of [...params.keys()].sort()) {
    payload += key + (params.get(key) ?? "");
  }
  return createHmac("sha1", authToken).update(Buffer.from(payload, "utf8")).digest("base64");
}

function signaturesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Candidate URLs: what we told Twilio to call, and what the request actually arrived on. */
function candidateUrls(event: Parameters<APIGatewayProxyHandlerV2>[0]): string[] {
  const urls: string[] = [];
  const configured = env.smsStatusCallbackUrl || statusCallbackUrlFromBase();
  if (configured) urls.push(configured);
  const host = event.headers?.host ?? event.headers?.Host;
  if (host) {
    const query = event.rawQueryString ? `?${event.rawQueryString}` : "";
    urls.push(`https://${host}${event.rawPath ?? ""}${query}`);
  }
  return urls;
}

function statusCallbackUrlFromBase(): string {
  const base = env.ringPublicApiBaseUrl.replace(/\/$/, "");
  return base ? `${base}/api/sms/twilio/status` : "";
}

async function verifySignature(
  event: Parameters<APIGatewayProxyHandlerV2>[0],
  params: URLSearchParams,
): Promise<"valid" | "invalid" | "unverifiable"> {
  const provided = event.headers?.["x-twilio-signature"] ?? event.headers?.["X-Twilio-Signature"];
  if (!provided) return "invalid";

  const secret = await loadTwilioSecret(env.incidentMediaTwilioSecretArn);
  if (!secret || !("authToken" in secret) || !secret.authToken) return "unverifiable";

  for (const url of candidateUrls(event)) {
    if (signaturesMatch(provided, expectedSignature(secret.authToken, url, params))) {
      return "valid";
    }
  }
  return "invalid";
}

function decodeBody(event: Parameters<APIGatewayProxyHandlerV2>[0]): URLSearchParams {
  const raw = event.body ?? "";
  const decoded = event.isBase64Encoded ? Buffer.from(raw, "base64").toString("utf8") : raw;
  return new URLSearchParams(decoded);
}

/** Twilio retries on non-2xx; always ack so a rejected receipt does not loop. */
function ack() {
  return { statusCode: 204, body: "" };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const params = decodeBody(event);
    const verification = await verifySignature(event, params);
    if (verification === "invalid") {
      console.warn(JSON.stringify({ type: "outbound.sms", event: "delivery_receipt_rejected" }));
      return ack();
    }

    const messageStatus = params.get("MessageStatus") ?? params.get("SmsStatus") ?? "unknown";
    const errorCode = params.get("ErrorCode");
    const payload = {
      type: "outbound.sms",
      event: "delivery_receipt",
      messageId: params.get("MessageSid"),
      providerStatus: messageStatus,
      errorCode: errorCode || null,
      // Twilio secret uses the API-key shape, which carries no auth token to verify against.
      signatureVerified: verification === "valid",
    };

    if (TERMINAL_FAILURE_STATUSES.has(messageStatus)) {
      console.error(JSON.stringify(payload));
    } else {
      console.info(JSON.stringify(payload));
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        type: "outbound.sms",
        event: "delivery_receipt_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  return ack();
};
