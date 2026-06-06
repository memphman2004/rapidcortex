import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import type { SmsMessageType, SmsSendResult } from "rapid-cortex-shared";
import { redactE164Phone } from "rapid-cortex-shared";

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
  if (name === "Throttling" || name === "TooManyRequestsException" || name === "ServiceUnavailable" || m.includes("throttl")) {
    return { retryable: true, errorCode: code, errorMessage: message.slice(0, 500) };
  }
  if (name === "InternalError" || name === "InternalFailure" || name === "RequestTimeout" || m.includes("timeout")) {
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
 * AWS SNS direct-to-number publish (SMS). All AWS-specific behavior stays in this module.
 * Optional configuration set / pool ids are non-secret; when set they are logged for ops (SNS Publish
 * does not accept Pinpoint pool ids — use account-level SMS settings or a future Pinpoint path).
 */
export async function sendWithAwsSns(args: {
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

  const sns = new SNSClient({ region: args.region });
  try {
    const out = await sns.send(
      new PublishCommand({
        PhoneNumber: args.toPhoneE164,
        Message: args.messageBody,
        MessageAttributes: {
          "AWS.SNS.SMS.SMSType": {
            DataType: "String",
            StringValue: "Transactional",
          },
        },
      }),
    );

    console.info(
      JSON.stringify({
        type: "outbound.sms",
        provider: "aws",
        outcome: "sent",
        messageType: args.messageType,
        agencyId: args.agencyId,
        incidentId: args.incidentId,
        destinationMasked: recipientRedacted,
        messageId: out.MessageId ?? null,
        configurationSetName: args.configurationSetName ?? null,
        poolId: args.poolId ?? null,
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
