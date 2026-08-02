import type { SNSHandler } from "aws-lambda";
import { routeInboundSms } from "../../services/smsInboundRouter.js";

/**
 * Inbound (two-way) SMS from AWS End User Messaging.
 *
 * AWS publishes each inbound message to an SNS topic rather than calling an HTTP webhook the way
 * Twilio does, so this is an SNS-triggered handler. Routing is shared with the Twilio path: both
 * resolve the destination number to an agency via the SMS routing table.
 */

type AwsInboundMessage = {
  originationNumber?: string;
  destinationNumber?: string;
  messageBody?: string;
  messageKeyword?: string;
  inboundMessageId?: string;
};

function parseInbound(raw: string): AwsInboundMessage | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as AwsInboundMessage;
  } catch {
    return null;
  }
}

export const handler: SNSHandler = async (event) => {
  for (const record of event.Records) {
    const inbound = parseInbound(record.Sns?.Message ?? "");
    if (!inbound) {
      console.error(
        JSON.stringify({ type: "inbound.sms", provider: "aws", event: "unparseable_payload" }),
      );
      continue;
    }

    const toPhone = inbound.destinationNumber?.trim() ?? "";
    const callerPhone = inbound.originationNumber?.trim() ?? "";
    const rawBody = inbound.messageBody?.trim() ?? "";
    if (!rawBody || !toPhone) continue;

    try {
      const outcome = await routeInboundSms({
        toPhone,
        callerPhone,
        rawBody,
        // Twilio's parameter names, so downstream intake sees one shape regardless of carrier path.
        inboundParams: {
          From: callerPhone,
          To: toPhone,
          Body: rawBody,
          MessageSid: inbound.inboundMessageId ?? "",
          Provider: "aws",
        },
      });
      console.info(
        JSON.stringify({
          type: "inbound.sms",
          provider: "aws",
          event: "routed",
          outcome,
          messageId: inbound.inboundMessageId ?? null,
        }),
      );
    } catch (err) {
      // Throwing would make SNS retry and re-deliver an emergency message to intake twice.
      console.error(
        JSON.stringify({
          type: "inbound.sms",
          provider: "aws",
          event: "route_failed",
          messageId: inbound.inboundMessageId ?? null,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
};
