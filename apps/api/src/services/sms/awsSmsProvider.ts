import {
  PinpointSMSVoiceV2Client,
  SendTextMessageCommand,
} from "@aws-sdk/client-pinpoint-sms-voice-v2";
import type { SmsMessageType, SmsSendResult } from "rapid-cortex-shared";
import { redactE164Phone } from "rapid-cortex-shared";

/**
 * AWS End User Messaging SMS (the SMS/Voice v2 API, `pinpoint-sms-voice-v2`).
 *
 * Replaces the earlier SNS `Publish` path, which could not select an origination number per
 * message and so could not honor an agency's own sender. Despite the SDK package name, this API
 * is unaffected by the Amazon Pinpoint end of support on 2026-10-30.
 */

/** Lambda containers are reused; one client per region avoids rebuilding it per invocation. */
const clients = new Map<string, PinpointSMSVoiceV2Client>();

function clientFor(region: string): PinpointSMSVoiceV2Client {
  const existing = clients.get(region);
  if (existing) return existing;
  const created = new PinpointSMSVoiceV2Client({ region });
  clients.set(region, created);
  return created;
}

/** E.164: leading +, then 2–15 digits (ITU max length). */
function isE164(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

export type AwsSmsErrorClassification = {
  retryable: boolean;
  errorCode: string;
  errorMessage: string;
};

/**
 * Classify AWS SNS SMS errors for failover and tests.
 * Non-retryable: bad number, opt-out, validation, permanent account issues.
 */
export function classifyAwsSmsError(e: unknown): AwsSmsErrorClassification {
  const name = e && typeof e === "object" && "name" in e ? String((e as { name?: string }).name) : "Error";
  const message = e instanceof Error ? e.message : String(e);
  const m = message.toLowerCase();
  const code = name;

  if (
    name === "InvalidParameter" ||
    name === "InvalidParameterValue" ||
    name === "ValidationException" ||
    m.includes("invalid phone") ||
    m.includes("invalid parameter")
  ) {
    return { retryable: false, errorCode: code, errorMessage: message.slice(0, 500) };
  }
  if (name === "OptedOutException" || name === "EndpointDisabled" || m.includes("opt out") || m.includes("opted out")) {
    return { retryable: false, errorCode: code, errorMessage: message.slice(0, 500) };
  }
  // v2 API surfaces these for a missing/unregistered origination identity or an exhausted spend
  // quota. Failing them over to Twilio is right — retrying AWS cannot succeed.
  if (
    name === "AccessDeniedException" ||
    name === "ResourceNotFoundException" ||
    name === "ConflictException" ||
    name === "ServiceQuotaExceededException"
  ) {
    return { retryable: false, errorCode: code, errorMessage: message.slice(0, 500) };
  }
  if (
    name === "Throttling" ||
    name === "ThrottlingException" ||
    name === "TooManyRequestsException" ||
    name === "ServiceUnavailable" ||
    m.includes("throttl")
  ) {
    return { retryable: true, errorCode: code, errorMessage: message.slice(0, 500) };
  }
  if (
    name === "InternalError" ||
    name === "InternalFailure" ||
    name === "InternalServerException" ||
    name === "RequestTimeout" ||
    m.includes("timeout")
  ) {
    return { retryable: true, errorCode: code, errorMessage: message.slice(0, 500) };
  }
  if (name === "NetworkingError" || name === "TimeoutError" || m.includes("econnreset") || m.includes("socket")) {
    return { retryable: true, errorCode: code, errorMessage: message.slice(0, 500) };
  }
  if (name === "LimitExceededException") {
    return { retryable: true, errorCode: code, errorMessage: message.slice(0, 500) };
  }
  return { retryable: false, errorCode: code, errorMessage: message.slice(0, 500) };
}

/**
 * Resolve which identity the message is sent from, in descending order of specificity:
 * the agency's own number, then the shared pool, then whatever the account auto-selects.
 */
function resolveOriginationIdentity(args: {
  agencySenderE164?: string;
  poolId?: string;
}): { originationIdentity?: string; senderScope: "agency" | "pool" | "account" } {
  const agencySender = args.agencySenderE164?.trim();
  if (agencySender) return { originationIdentity: agencySender, senderScope: "agency" };
  const poolId = args.poolId?.trim();
  if (poolId) return { originationIdentity: poolId, senderScope: "pool" };
  return { senderScope: "account" };
}

/**
 * AWS End User Messaging SMS send. All AWS-specific behavior stays in this module.
 * The configuration set is what routes delivery events, so leaving it unset means the same
 * blind spot Twilio had before delivery receipts: an accepted send and a dropped one look alike.
 */
export async function sendWithAwsSms(args: {
  toPhoneE164: string;
  messageBody: string;
  agencyId: string;
  incidentId: string;
  region: string;
  useSimulator: boolean;
  messageType: SmsMessageType;
  /** Non-secret operator config (logged, not credentials). */
  configurationSetName?: string;
  poolId?: string;
  /** Agency-owned sender, already tenant-scoped by the caller. */
  agencySenderE164?: string;
}): Promise<SmsSendResult> {
  const sentAt = new Date().toISOString();
  const recipientRedacted = isE164(args.toPhoneE164) ? redactE164Phone(args.toPhoneE164) : "***";

  if (!isE164(args.toPhoneE164)) {
    console.error(
      JSON.stringify({
        type: "outbound.sms",
        provider: "aws",
        outcome: "invalid_destination",
        messageType: args.messageType,
        agencyId: args.agencyId,
        incidentId: args.incidentId,
        destinationMasked: recipientRedacted,
        errorName: "INVALID_E164",
        retryable: false,
      }),
    );
    return {
      provider: "aws",
      status: "failed",
      errorCode: "INVALID_E164",
      errorMessage: "Destination must be a valid E.164 phone number (e.g. +15551234567)",
      recipientRedacted: "***",
      sentAt,
      retryable: false,
    };
  }

  if (args.useSimulator) {
    console.info(
      JSON.stringify({
        type: "outbound.sms",
        provider: "aws",
        mode: "simulator",
        messageType: args.messageType,
        agencyId: args.agencyId,
        incidentId: args.incidentId,
        destinationMasked: recipientRedacted,
        configurationSetName: args.configurationSetName ?? null,
        poolId: args.poolId ?? null,
      }),
    );
    return {
      provider: "aws",
      status: "sent",
      messageId: "aws-simulator",
      recipientRedacted,
      sentAt,
      retryable: false,
    };
  }

  const { originationIdentity, senderScope } = resolveOriginationIdentity(args);

  try {
    const out = await clientFor(args.region).send(
      new SendTextMessageCommand({
        DestinationPhoneNumber: args.toPhoneE164,
        MessageBody: args.messageBody,
        MessageType: "TRANSACTIONAL",
        OriginationIdentity: originationIdentity,
        ConfigurationSetName: args.configurationSetName?.trim() || undefined,
      }),
    );

    console.info(
      JSON.stringify({
        type: "outbound.sms",
        provider: "aws",
        // AWS has accepted the message; the handset outcome arrives later as a configuration-set
        // delivery event. Do not read this as proof of delivery.
        outcome: "accepted",
        messageType: args.messageType,
        agencyId: args.agencyId,
        incidentId: args.incidentId,
        destinationMasked: recipientRedacted,
        messageId: out.MessageId ?? null,
        configurationSetName: args.configurationSetName ?? null,
        senderScope,
        sender: originationIdentity ?? null,
        deliveryEventsEnabled: Boolean(args.configurationSetName?.trim()),
      }),
    );

    return {
      provider: "aws",
      status: "sent",
      messageId: out.MessageId ?? undefined,
      recipientRedacted,
      sentAt,
      retryable: false,
    };
  } catch (e: unknown) {
    const { retryable, errorCode, errorMessage } = classifyAwsSmsError(e);
    console.error(
      JSON.stringify({
        type: "outbound.sms",
        provider: "aws",
        outcome: "failed",
        messageType: args.messageType,
        agencyId: args.agencyId,
        incidentId: args.incidentId,
        destinationMasked: recipientRedacted,
        errorName: errorCode,
        retryable,
      }),
    );
    return {
      provider: "aws",
      status: "failed",
      errorCode,
      errorMessage,
      recipientRedacted,
      sentAt,
      retryable,
    };
  }
}
