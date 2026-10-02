import type { SmsMessageType, SmsSendResult } from "rapid-cortex-shared";
import { redactE164Phone } from "rapid-cortex-shared";

export function sendMockSms(args: {
  toPhoneE164: string;
  agencyId: string;
  incidentId: string;
  messageType: SmsMessageType;
}): SmsSendResult {
  const sentAt = new Date().toISOString();
  console.info(
    JSON.stringify({
      type: "outbound.sms",
      provider: "mock",
      messageType: args.messageType,
      agencyId: args.agencyId,
      incidentId: args.incidentId,
      destinationMasked: redactE164Phone(args.toPhoneE164),
    }),
  );
  return {
    provider: "mock",
    status: "sent",
    messageId: "mock-message-id",
    recipientRedacted: redactE164Phone(args.toPhoneE164),
    sentAt,
    retryable: false,
  };
}
