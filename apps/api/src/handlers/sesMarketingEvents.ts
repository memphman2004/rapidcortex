/**
 * SES marketing configuration set events (SNS) → marketing-leads engagement + list cleanup.
 * Tags on send: unsubscribeToken, campaignId.
 */

import type { SNSEvent, SNSHandler } from "aws-lambda";
import { PutSuppressedDestinationCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import {
  setMarketingLeadStatusByToken,
  updateMarketingLeadEngagementByToken,
} from "../lib/rapid-iq/marketing-contacts-upsert.js";
import { unsubscribeEmailEverywhere } from "../lib/rapid-iq/email-list-db.js";
import { incrementSalesCampaignStat } from "../lib/rapid-iq/sales-automation-db.js";

type SesTag = { name?: string; value?: string; Name?: string; Value?: string };

type SesMarketingEvent = {
  eventType?: string;
  notificationType?: string;
  bounce?: { bounceType?: string };
  mail?: {
    tags?: Record<string, string[]> | SesTag[];
    commonHeaders?: { subject?: string };
  };
};

const sesv2 = new SESv2Client({
  region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1",
});

function parseBody(raw: string): SesMarketingEvent | null {
  try {
    const parsed = JSON.parse(raw) as SesMarketingEvent & { Message?: string };
    if (typeof parsed.Message === "string") {
      return JSON.parse(parsed.Message) as SesMarketingEvent;
    }
    return parsed;
  } catch {
    return null;
  }
}

function tagValue(mail: SesMarketingEvent["mail"], key: string): string | undefined {
  if (!mail?.tags) return undefined;
  if (Array.isArray(mail.tags)) {
    const hit = mail.tags.find((t) => (t.name ?? t.Name ?? "").toLowerCase() === key.toLowerCase());
    return (hit?.value ?? hit?.Value)?.trim() || undefined;
  }
  const arr = mail.tags[key] ?? mail.tags[key.toLowerCase()] ?? mail.tags[key.toUpperCase()];
  if (Array.isArray(arr) && arr[0]) return String(arr[0]).trim();
  return undefined;
}

async function suppress(email: string, reason: "BOUNCE" | "COMPLAINT"): Promise<void> {
  try {
    await sesv2.send(
      new PutSuppressedDestinationCommand({
        EmailAddress: email.trim().toLowerCase(),
        Reason: reason,
      }),
    );
  } catch (err) {
    console.warn(
      JSON.stringify({
        msg: "ses_marketing_suppress_failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

export async function processMarketingSesEvent(body: SesMarketingEvent): Promise<void> {
  const kind = (body.eventType ?? body.notificationType ?? "").trim();
  const token = tagValue(body.mail, "unsubscribeToken") ?? tagValue(body.mail, "contactToken");
  const campaignId = tagValue(body.mail, "campaignId");
  if (!token) {
    console.log(JSON.stringify({ msg: "ses_marketing_event_no_token", kind }));
    return;
  }

  if (kind === "Bounce" || kind === "bounce") {
    if ((body.bounce?.bounceType ?? "").toLowerCase() !== "permanent") return;
    const hit = await setMarketingLeadStatusByToken(token, "bounced");
    if (hit?.email) {
      await unsubscribeEmailEverywhere(hit.email);
      await suppress(hit.email, "BOUNCE");
    }
    if (campaignId) await incrementSalesCampaignStat(campaignId, "bounced");
    return;
  }

  if (kind === "Complaint" || kind === "complaint") {
    const hit = await setMarketingLeadStatusByToken(token, "complained");
    if (hit?.email) {
      await unsubscribeEmailEverywhere(hit.email);
      await suppress(hit.email, "COMPLAINT");
    }
    if (campaignId) await incrementSalesCampaignStat(campaignId, "complained");
    return;
  }

  if (kind === "Open" || kind === "open") {
    await updateMarketingLeadEngagementByToken(token, "lastOpenedAt");
    if (campaignId) await incrementSalesCampaignStat(campaignId, "opened");
    return;
  }

  if (kind === "Click" || kind === "click") {
    await updateMarketingLeadEngagementByToken(token, "lastClickedAt");
    if (campaignId) await incrementSalesCampaignStat(campaignId, "clicked");
    return;
  }

  if (kind === "Delivery" || kind === "delivery") {
    if (campaignId) await incrementSalesCampaignStat(campaignId, "delivered");
    return;
  }

  if (kind === "Send" || kind === "send") {
    if (campaignId) await incrementSalesCampaignStat(campaignId, "sent");
  }
}

export const handler: SNSHandler = async (event: SNSEvent) => {
  for (const record of event.Records) {
    const body = parseBody(record.Sns.Message);
    if (!body) continue;
    try {
      await processMarketingSesEvent(body);
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "ses_marketing_event_failed",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
};
