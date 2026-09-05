/**
 * Send approved, scheduled outreach steps. Fail-closed: SES_MOCK, missing from-address,
 * or missing recipient skips live send. 30-day contact window is re-checked at send time.
 */

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../../../lib/env.js";
import { makeId } from "../../../lib/ids.js";
import { sesConfigurationSetFields } from "../../../lib/ses/sesConfigurationSet.js";
import { checkSuppression } from "../../../lib/rapid-iq/sales-automation-engine.js";
import {
  listSalesSequences,
  putSalesSequence,
  recordSalesSend,
} from "../../../lib/rapid-iq/sales-automation-db.js";
import { AuditRepository } from "../../../repositories/auditRepository.js";

const ses = new SESClient({});
const auditRepo = new AuditRepository();
const MAX_SENDS_PER_RUN = 20;

function salesAutomationEnabled(): boolean {
  const v = process.env.ENABLE_SALES_AUTOMATION?.trim().toLowerCase();
  if (v === "0" || v === "false") return false;
  return true;
}

function fromAddress(): string {
  return process.env.SES_FROM_EMAIL?.trim() || env.sesFromEmail || "noreply@rapidcortex.us";
}

export async function handler(): Promise<{ scanned: number; sent: number; skipped: number }> {
  if (!salesAutomationEnabled()) {
    return { scanned: 0, sent: 0, skipped: 0 };
  }
  const sequences = await listSalesSequences(200);
  const now = Date.now();
  let sent = 0;
  let skipped = 0;
  let scanned = 0;

  for (const seq of sequences) {
    if (seq.status !== "active") continue;
    scanned += 1;
    let dirty = false;
    for (const step of seq.steps) {
      if (sent >= MAX_SENDS_PER_RUN) break;
      if (step.status !== "scheduled" || !step.scheduledAt) continue;
      if (Date.parse(step.scheduledAt) > now) continue;

      const suppression = await checkSuppression(seq.recipientEmail);
      if (suppression.suppressed) {
        seq.status = "suppressed";
        seq.suppressedReason = suppression.reason;
        seq.updatedAt = new Date().toISOString();
        dirty = true;
        skipped += 1;
        break;
      }

      const from = fromAddress();
      const live = !env.sesMock && from.includes("@") && seq.recipientEmail.includes("@");
      if (live) {
        try {
          await ses.send(
            new SendEmailCommand({
              Source: from,
              Destination: { ToAddresses: [seq.recipientEmail] },
              Message: {
                Subject: { Data: step.email.subject, Charset: "UTF-8" },
                Body: {
                  Text: { Data: step.email.bodyText, Charset: "UTF-8" },
                  ...(step.email.bodyHtml
                    ? { Html: { Data: step.email.bodyHtml, Charset: "UTF-8" } }
                    : {}),
                },
              },
              ...sesConfigurationSetFields(),
            }),
          );
        } catch (err) {
          console.warn(
            JSON.stringify({
              msg: "rapid_iq_sales_ses_failed",
              sequenceId: seq.sequenceId,
              error: err instanceof Error ? err.message : String(err),
            }),
          );
          skipped += 1;
          continue;
        }
      } else {
        console.log(
          JSON.stringify({
            msg: "rapid_iq_sales_send_log_only",
            sequenceId: seq.sequenceId,
            stepId: step.stepId,
            to: seq.recipientEmail,
          }),
        );
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
          actorId: "system",
          type: AUDIT_EVENT_TYPES.RAPID_IQ_SALES_EMAIL_SENT,
          details: {
            sequenceId: seq.sequenceId,
            stepId: step.stepId,
            live,
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
