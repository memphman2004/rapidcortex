/**
 * SES bounce / complaint SNS → permanent suppression + structured logs.
 * Required before SES production access and before go-live invoice sends.
 */
import type { SNSEvent, SNSHandler } from "aws-lambda";
import { PutSuppressedDestinationCommand, SESv2Client } from "@aws-sdk/client-sesv2";

type BounceRecipient = { emailAddress?: string };
type ComplaintRecipient = { emailAddress?: string };

type SesNotificationBody = {
  notificationType?: string;
  eventType?: string;
  bounce?: {
    bounceType?: string;
    bounceSubType?: string;
    bouncedRecipients?: BounceRecipient[];
  };
  complaint?: {
    complainedRecipients?: ComplaintRecipient[];
    complaintFeedbackType?: string;
  };
  mail?: {
    messageId?: string;
    source?: string;
  };
};

const sesv2 = new SESv2Client({ region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1" });

function parseNotification(rawMessage: string): SesNotificationBody | null {
  try {
    const parsed = JSON.parse(rawMessage) as SesNotificationBody & { Message?: string };
    // Rare double-wrap (SNS re-publish)
    if (typeof parsed.Message === "string") {
      return JSON.parse(parsed.Message) as SesNotificationBody;
    }
    return parsed;
  } catch {
    return null;
  }
}

function eventKind(body: SesNotificationBody): string {
  return (body.notificationType ?? body.eventType ?? "").trim();
}

export async function suppressAddress(email: string, reason: "BOUNCE" | "COMPLAINT"): Promise<void> {
  const address = email.trim().toLowerCase();
  if (!address || !address.includes("@")) return;
  await sesv2.send(
    new PutSuppressedDestinationCommand({
      EmailAddress: address,
      Reason: reason,
    }),
  );
  console.log(JSON.stringify({ msg: "ses_suppression_recorded", email: address, reason }));
}

export async function processSesNotificationBody(body: SesNotificationBody): Promise<{
  suppressed: string[];
  skipped: string[];
}> {
  const suppressed: string[] = [];
  const skipped: string[] = [];
  const kind = eventKind(body).toLowerCase();
  const mailId = body.mail?.messageId ?? "";

  if (kind === "bounce") {
    const bounceType = (body.bounce?.bounceType ?? "").toLowerCase();
    const recipients = body.bounce?.bouncedRecipients ?? [];
    if (bounceType !== "permanent") {
      for (const r of recipients) {
        const email = r.emailAddress?.trim() ?? "";
        if (email) skipped.push(email);
      }
      console.log(
        JSON.stringify({
          msg: "ses_bounce_transient_skipped",
          bounceType: body.bounce?.bounceType,
          bounceSubType: body.bounce?.bounceSubType,
          mailId,
          count: recipients.length,
        }),
      );
      return { suppressed, skipped };
    }
    for (const r of recipients) {
      const email = r.emailAddress?.trim() ?? "";
      if (!email) continue;
      await suppressAddress(email, "BOUNCE");
      suppressed.push(email);
      console.log(JSON.stringify({ msg: "ses_hard_bounce_suppressed", email, mailId }));
    }
    return { suppressed, skipped };
  }

  if (kind === "complaint") {
    for (const r of body.complaint?.complainedRecipients ?? []) {
      const email = r.emailAddress?.trim() ?? "";
      if (!email) continue;
      await suppressAddress(email, "COMPLAINT");
      suppressed.push(email);
      console.log(
        JSON.stringify({
          msg: "ses_complaint_suppressed",
          email,
          feedbackType: body.complaint?.complaintFeedbackType,
          mailId,
        }),
      );
    }
    return { suppressed, skipped };
  }

  console.log(JSON.stringify({ msg: "ses_notification_ignored", kind, mailId }));
  return { suppressed, skipped };
}

export const handler: SNSHandler = async (event: SNSEvent): Promise<void> => {
  for (const record of event.Records) {
    const body = parseNotification(record.Sns.Message);
    if (!body) {
      console.error(JSON.stringify({ msg: "ses_notification_parse_failed", messageId: record.Sns.MessageId }));
      continue;
    }
    await processSesNotificationBody(body);
  }
};
