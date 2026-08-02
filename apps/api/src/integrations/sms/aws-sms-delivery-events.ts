import type { SNSHandler } from "aws-lambda";
import { redactE164Phone } from "rapid-cortex-shared";

/**
 * AWS End User Messaging delivery events, the counterpart to the Twilio status callback.
 *
 * Without these, a successful `SendTextMessage` response is the last signal we get, so a
 * carrier-blocked message looks identical to a delivered one. Events arrive only when the send
 * carried a configuration set that has an SNS event destination.
 *
 * Log-only by design: nothing is persisted and no tenant data is read. The recipient number is
 * redacted and the message body is never logged.
 */

const TERMINAL_FAILURE_EVENTS = new Set([
  "TEXT_BLOCKED",
  "TEXT_CARRIER_BLOCKED",
  "TEXT_CARRIER_UNREACHABLE",
  "TEXT_INVALID",
  "TEXT_INVALID_MESSAGE",
  "TEXT_SPAM",
  "TEXT_TTL_EXPIRED",
  "TEXT_UNKNOWN",
  "TEXT_UNREACHABLE",
]);

type AwsDeliveryEvent = {
  eventType?: string;
  messageId?: string;
  messageStatus?: string;
  messageStatusDescription?: string;
  destinationPhoneNumber?: string;
  originationPhoneNumber?: string;
  isoCountryCode?: string;
};

function parseEvent(raw: string): AwsDeliveryEvent | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as AwsDeliveryEvent;
  } catch {
    return null;
  }
}

export const handler: SNSHandler = async (event) => {
  for (const record of event.Records) {
    const delivery = parseEvent(record.Sns?.Message ?? "");
    if (!delivery) {
      console.error(
        JSON.stringify({ type: "outbound.sms", provider: "aws", event: "delivery_event_unparseable" }),
      );
      continue;
    }

    const eventType = delivery.eventType ?? "UNKNOWN";
    const destination = delivery.destinationPhoneNumber?.trim();
    const payload = {
      type: "outbound.sms",
      provider: "aws",
      event: "delivery_event",
      eventType,
      messageId: delivery.messageId ?? null,
      providerStatus: delivery.messageStatus ?? null,
      statusDescription: delivery.messageStatusDescription ?? null,
      // The sending number is ours and is the whole point of per-agency senders; the recipient is not.
      sender: delivery.originationPhoneNumber ?? null,
      destinationMasked: destination ? redactE164Phone(destination) : null,
    };

    if (TERMINAL_FAILURE_EVENTS.has(eventType)) {
      console.error(JSON.stringify(payload));
    } else {
      console.info(JSON.stringify(payload));
    }
  }
};
