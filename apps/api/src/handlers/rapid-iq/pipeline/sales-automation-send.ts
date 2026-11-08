/**
 * Send approved, scheduled campaign emails to potential clients.
 * Prefer the connected Outlook mailbox (Graph sendMail, Sent Items).
 * Fall back to SES, then log-only when SES_MOCK / missing from-address.
 * Fail-closed: missing recipient skips live send. 30-day contact window is
 * re-checked at send time.
 */

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../../../lib/env.js";
import { makeId } from "../../../lib/ids.js";
import { sesMarketingConfigurationSetFields } from "../../../lib/ses/sesMarketingConfigurationSet.js";
import {
  applyUnsubscribeTokenToEmailBodies,
  checkSuppression,
} from "../../../lib/rapid-iq/sales-automation-engine.js";
import {
  getOutlookConnection,
  getSalesSequence,
  incrementSalesCampaignStat,
  listSalesSequences,
  putOutlookConnection,
  putSalesSequence,
  recordSalesSend,
} from "../../../lib/rapid-iq/sales-automation-db.js";
import { ddb } from "../../../repositories/baseRepository.js";
import {
  ensureOutlookAccessToken,
  isOutlookGraphMock,
  sendOutlookMail,
  type SalesOutlookConnection,
} from "../../../lib/rapid-iq/outlook-graph.js";
import { AuditRepository } from "../../../repositories/auditRepository.js";
import type { RapidIqSalesOutreachStep, RapidIqSalesSequence } from "rapid-cortex-shared";

const ses = new SESClient({});
const auditRepo = new AuditRepository();
const MAX_SENDS_PER_RUN = 100;

function salesAutomationEnabled(): boolean {
  const v = process.env.ENABLE_SALES_AUTOMATION?.trim().toLowerCase();
  if (v === "0" || v === "false") return false;
  return true;
}

function fromAddress(): string {
  return process.env.SES_FROM_EMAIL?.trim() || env.sesFromEmail || "noreply@nexcortiq.us";
}

async function lookupUnsubscribeToken(email: string): Promise<string> {
  const marketingTable = env.marketingLeadsTable?.trim();
  if (!marketingTable) return "";
  try {
    const profile = await ddb.send(
      new GetCommand({
        TableName: marketingTable,
        Key: { pk: `LEAD#${email.trim().toLowerCase()}`, sk: "PROFILE" },
      }),
    );
    return typeof profile.Item?.unsubscribeToken === "string"
      ? profile.Item.unsubscribeToken
      : "";
  } catch {
    return "";
  }
}

export type CampaignSendChannel = "outlook" | "outlook_mock" | "ses" | "log";

export async function deliverCampaignStep(
  seq: RapidIqSalesSequence,
  step: RapidIqSalesOutreachStep,
  outlook: SalesOutlookConnection | null,
): Promise<{ live: boolean; channel: CampaignSendChannel; outlook?: SalesOutlookConnection }> {
  const unsubscribeToken = await lookupUnsubscribeToken(seq.recipientEmail);
  const bodies = applyUnsubscribeTokenToEmailBodies(
    { text: step.email.bodyText, html: step.email.bodyHtml },
    unsubscribeToken || null,
  );

  if (outlook) {
    if (outlook.mock || isOutlookGraphMock()) {
      console.log(
        JSON.stringify({
          msg: "rapid_iq_sales_outlook_mock",
          sequenceId: seq.sequenceId,
          stepId: step.stepId,
          to: seq.recipientEmail,
          mailbox: outlook.mailbox,
        }),
      );
      return { live: false, channel: "outlook_mock" };
    }
    const ensured = await ensureOutlookAccessToken(outlook);
    await sendOutlookMail({
      accessToken: ensured.accessToken,
      to: seq.recipientEmail,
      subject: step.email.subject,
      text: bodies.text,
      html: bodies.html,
    });
    return { live: true, channel: "outlook", outlook: ensured.next };
  }

  const from = fromAddress();
  const live = !env.sesMock && from.includes("@") && seq.recipientEmail.includes("@");
  if (live) {
    const campaignId = seq.attribution.campaignId?.trim() || seq.sequenceId;
    await ses.send(
      new SendEmailCommand({
        Source: from,
        Destination: { ToAddresses: [seq.recipientEmail] },
        Message: {
          Subject: { Data: step.email.subject, Charset: "UTF-8" },
          Body: {
            Text: { Data: bodies.text, Charset: "UTF-8" },
            ...(bodies.html ? { Html: { Data: bodies.html, Charset: "UTF-8" } } : {}),
          },
        },
        Tags: [
          { Name: "campaignId", Value: campaignId.slice(0, 256) },
          ...(unsubscribeToken
            ? [{ Name: "unsubscribeToken", Value: unsubscribeToken.slice(0, 256) }]
            : []),
        ],
        ...sesMarketingConfigurationSetFields(),
      }),
    );
    try {
      await incrementSalesCampaignStat(campaignId, "sent");
    } catch {
      /* stats must not block send */
    }
    return { live: true, channel: "ses" };
  }

  console.log(
    JSON.stringify({
      msg: "rapid_iq_sales_send_log_only",
      sequenceId: seq.sequenceId,
      stepId: step.stepId,
      to: seq.recipientEmail,
    }),
  );
  return { live: false, channel: "log" };
}

export async function handler(): Promise<{ scanned: number; sent: number; skipped: number }> {
  if (!salesAutomationEnabled()) {
    return { scanned: 0, sent: 0, skipped: 0 };
  }
  const sequences = await listSalesSequences(500);
  const now = Date.now();
  let sent = 0;
  let skipped = 0;
  let scanned = 0;
  let outlook = await getOutlookConnection();

  for (const seq of sequences) {
    if (seq.status !== "active") continue;
    scanned += 1;
    let dirty = false;
    for (const step of seq.steps) {
      if (sent >= MAX_SENDS_PER_RUN) break;
      if (step.status !== "scheduled" || !step.scheduledAt) continue;
      if (Date.parse(step.scheduledAt) > now) continue;

      const suppression = await checkSuppression(seq.recipientEmail, {
        exceptSequenceId: seq.sequenceId,
      });
      if (suppression.suppressed) {
        seq.status = "suppressed";
        seq.suppressedReason = suppression.reason;
        seq.updatedAt = new Date().toISOString();
        dirty = true;
        skipped += 1;
        break;
      }

      let delivery: Awaited<ReturnType<typeof deliverCampaignStep>>;
      try {
        delivery = await deliverCampaignStep(seq, step, outlook);
      } catch (err) {
        console.warn(
          JSON.stringify({
            msg: "rapid_iq_sales_send_failed",
            sequenceId: seq.sequenceId,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
        skipped += 1;
        continue;
      }
      if (delivery.outlook) {
        outlook = delivery.outlook;
        try {
          await putOutlookConnection(delivery.outlook);
        } catch (err) {
          console.warn(
            JSON.stringify({
              msg: "rapid_iq_sales_outlook_token_persist_failed",
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }
      }

      const sentAt = new Date().toISOString();
      step.status = "sent";
      step.sentAt = sentAt;
      dirty = true;
      sent += 1;
      await recordSalesSend(seq.recipientEmail, sentAt, seq.sequenceId);
      try {
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: "platform",
          actorId: "system:sales-automation-send",
          type: AUDIT_EVENT_TYPES.RAPID_IQ_SALES_EMAIL_SENT,
          details: {
            sequenceId: seq.sequenceId,
            stepId: step.stepId,
            live: delivery.live,
            channel: delivery.channel,
          },
          createdAt: sentAt,
          resourceType: "rapid_iq_sales_seq",
          resourceId: seq.sequenceId,
        });
      } catch (err) {
        console.warn(
          JSON.stringify({
            msg: "rapid_iq_sales_send_audit_failed",
            sequenceId: seq.sequenceId,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }
    if (seq.steps.every((s) => s.status === "sent" || s.status === "skipped")) {
      seq.status = "completed";
      dirty = true;
    }
    if (dirty) {
      seq.updatedAt = new Date().toISOString();
      await putSalesSequence(seq);
    }
    if (sent >= MAX_SENDS_PER_RUN) break;
  }

  console.log(JSON.stringify({ msg: "rapid_iq_sales_send_run", scanned, sent, skipped }));
  return { scanned, sent, skipped };
}

/** Send any due scheduled steps on one sequence (used right after rcadmin approval). */
export async function sendDueStepsNow(sequenceId: string): Promise<{ sent: number; skipped: number }> {
  const seq = await getSalesSequence(sequenceId);
  if (!seq || seq.status !== "active") return { sent: 0, skipped: 0 };
  let outlook = await getOutlookConnection();
  const now = Date.now();
  let sent = 0;
  let skipped = 0;
  let dirty = false;
  for (const step of seq.steps) {
    if (step.status !== "scheduled" || !step.scheduledAt) continue;
    if (Date.parse(step.scheduledAt) > now) continue;
    const suppression = await checkSuppression(seq.recipientEmail, {
      exceptSequenceId: seq.sequenceId,
    });
    if (suppression.suppressed) {
      seq.status = "suppressed";
      seq.suppressedReason = suppression.reason;
      dirty = true;
      skipped += 1;
      break;
    }
    try {
      const delivery = await deliverCampaignStep(seq, step, outlook);
      if (delivery.outlook) {
        outlook = delivery.outlook;
        await putOutlookConnection(delivery.outlook);
      }
      const sentAt = new Date().toISOString();
      step.status = "sent";
      step.sentAt = sentAt;
      dirty = true;
      sent += 1;
      await recordSalesSend(seq.recipientEmail, sentAt, seq.sequenceId);
      try {
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: "platform",
          actorId: "system:sales-automation-send",
          type: AUDIT_EVENT_TYPES.RAPID_IQ_SALES_EMAIL_SENT,
          details: {
            sequenceId: seq.sequenceId,
            stepId: step.stepId,
            live: delivery.live,
            channel: delivery.channel,
            immediate: true,
          },
          createdAt: sentAt,
          resourceType: "rapid_iq_sales_seq",
          resourceId: seq.sequenceId,
        });
      } catch {
        /* audit must not abort send */
      }
    } catch (err) {
      console.warn(
        JSON.stringify({
          msg: "rapid_iq_sales_immediate_send_failed",
          sequenceId: seq.sequenceId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      skipped += 1;
    }
  }
  if (seq.steps.every((s) => s.status === "sent" || s.status === "skipped")) {
    seq.status = "completed";
    dirty = true;
  }
  if (dirty) {
    seq.updatedAt = new Date().toISOString();
    await putSalesSequence(seq);
  }
  return { sent, skipped };
}
