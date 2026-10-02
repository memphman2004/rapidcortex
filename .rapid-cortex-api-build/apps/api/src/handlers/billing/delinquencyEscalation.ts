/**
 * MSA Article 4.6 + 13.5 delinquency escalation handler.
 * Runs daily via EventBridge. Scans invoices with status "SENT" or "OVERDUE"
 * and transitions delinquency tiers based on days overdue.
 *
 * Tier thresholds (days past dueDate):
 *   1–30   → warning     ($50 late fee if not yet applied)
 *   31–60  → warning     (1.5%/month interest on outstanding balance)
 *   61–70  → suspended   (after 10-day notice window has elapsed)
 *   71+    → terminated  (after 15-day termination notice has elapsed)
 *
 * Never transitions to suspended/terminated without verifying notice was sent.
 */

import { PutMetricDataCommand, CloudWatchClient } from "@aws-sdk/client-cloudwatch";
import { ScanCommand, UpdateCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import { ddb } from "../../repositories/baseRepository.js";
import { calculateLateFee, calculateLateInterest } from "../../lib/billing/late-fees.js";

const cw = new CloudWatchClient({ region: env.region });

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  return Math.floor((b - a) / 86_400_000);
}

async function writeBillingAuditEvent(
  agencyId: string,
  invoiceId: string,
  eventType: string,
  details: Record<string, unknown>,
): Promise<void> {
  const t = nowIso();
  await ddb.send(
    new PutCommand({
      TableName: env.billingAuditLogTable,
      Item: {
        logId: makeId("blog"),
        agencyId,
        invoiceId,
        action: eventType,
        entityType: "invoice",
        entityId: invoiceId,
        userId: "system:delinquency-escalation",
        details,
        timestamp: t,
        createdAt: t,
      },
    }),
  );
}

async function applyLateFeeLineItem(invoiceId: string, agencyId: string, feeCents: number): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: env.invoiceItemsTable,
      Item: {
        invoiceItemId: makeId("invitem"),
        invoiceId,
        agencyId,
        description: `Late fee (MSA §4.6)`,
        quantity: 1,
        unitPrice: feeCents / 100,
        lineTotal: feeCents / 100,
        isLateFee: true,
        createdAt: nowIso(),
      },
    }),
  );
}

async function emitCloudWatchMetrics(delinquentCount: number, suspendedCount: number): Promise<void> {
  const now = new Date();
  await cw.send(
    new PutMetricDataCommand({
      Namespace: "RapidCortex/Billing",
      MetricData: [
        {
          MetricName: "DelinquentAgencies",
          Value: delinquentCount,
          Timestamp: now,
          Unit: "Count",
        },
        {
          MetricName: "SuspendedAgencies",
          Value: suspendedCount,
          Timestamp: now,
          Unit: "Count",
        },
      ],
    }),
  );
}

export const handler = async (): Promise<{
  ok: boolean;
  processed: number;
  warningCount: number;
  suspendedCount: number;
  terminatedCount: number;
  errors: number;
  runAt: string;
}> => {
  const today = todayIsoDate();
  let processed = 0;
  let warningCount = 0;
  let suspendedCount = 0;
  let terminatedCount = 0;
  let errors = 0;

  // Scan all sent/overdue invoices
  const out = await ddb.send(
    new ScanCommand({
      TableName: env.invoicesTable,
      FilterExpression: "#status IN (:sent, :overdue)",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":sent": "SENT", ":overdue": "OVERDUE" },
    }),
  );

  const invoices = (out.Items ?? []) as Array<{
    invoiceId: string;
    agencyId?: string;
    dueDate?: string;
    total?: number;
    amountPaid?: number;
    lateFeeApplied?: boolean;
    suspensionNoticeSentAt?: string;
    terminationNoticeSentAt?: string;
  }>;

  for (const invoice of invoices) {
    if (!invoice.invoiceId || !invoice.agencyId || !invoice.dueDate) continue;
    try {
      const daysOverdue = daysBetween(invoice.dueDate, today);
      if (daysOverdue <= 0) continue;

      const agencyId = invoice.agencyId;
      const invoiceId = invoice.invoiceId;
      const outstandingCents = Math.round(
        Math.max(0, Number(invoice.total ?? 0) - Number(invoice.amountPaid ?? 0)) * 100,
      );
      processed++;

      // --- Tier: warning (1-60 days overdue) ---
      if (daysOverdue >= 1 && daysOverdue <= 60) {
        warningCount++;

        // Apply one-time late fee if not yet applied
        if (!invoice.lateFeeApplied) {
          const fee = calculateLateFee(daysOverdue);
          await applyLateFeeLineItem(invoiceId, agencyId, fee);
          await ddb.send(
            new UpdateCommand({
              TableName: env.invoicesTable,
              Key: { invoiceId },
              UpdateExpression: "SET lateFeeApplied = :t, lateFeeAppliedAt = :now, updatedAt = :now",
              ExpressionAttributeValues: { ":t": true, ":now": nowIso() },
            }),
          );
          await writeBillingAuditEvent(agencyId, invoiceId, "late_fee.applied", {
            daysOverdue,
            feeCents: fee,
          });
        }

        // Apply monthly interest for 31-60 day tier
        if (daysOverdue >= 31 && outstandingCents > 0) {
          const interest = calculateLateInterest(outstandingCents, daysOverdue);
          if (interest > 0) {
            await applyLateFeeLineItem(invoiceId, agencyId, interest);
            await writeBillingAuditEvent(agencyId, invoiceId, "interest.applied", {
              daysOverdue,
              interestCents: interest,
              outstandingCents,
            });
          }
        }

        // Update delinquency tier on billing profile
        await updateBillingProfileDelinquency(agencyId, "warning", `Invoice ${invoiceId} is ${daysOverdue} days overdue`);
        await writeBillingAuditEvent(agencyId, invoiceId, "delinquency.warning", { daysOverdue });
      }

      // --- Tier: suspended (61-70 days overdue, ONLY after 10-day notice window) ---
      else if (daysOverdue >= 61 && daysOverdue <= 70) {
        const noticeSentAt = invoice.suspensionNoticeSentAt;
        if (noticeSentAt && daysBetween(noticeSentAt, today) >= 10) {
          suspendedCount++;
          await updateBillingProfileDelinquency(agencyId, "suspended", `Suspended: invoice ${invoiceId} ${daysOverdue} days overdue after notice`);
          await writeBillingAuditEvent(agencyId, invoiceId, "delinquency.suspended", { daysOverdue, noticeSentAt });
        }
        // If notice hasn't been sent yet, only warn — suspension notice is sent separately
      }

      // --- Tier: terminated (71+ days, ONLY after 15-day termination notice window) ---
      else if (daysOverdue >= 71) {
        suspendedCount++;
        const noticeSentAt = invoice.terminationNoticeSentAt;
        if (noticeSentAt && daysBetween(noticeSentAt, today) >= 15) {
          terminatedCount++;
          await updateBillingProfileDelinquency(agencyId, "terminated", `Terminated: invoice ${invoiceId} ${daysOverdue} days overdue after termination notice`);
          await writeBillingAuditEvent(agencyId, invoiceId, "delinquency.terminated", { daysOverdue, noticeSentAt });
        }
      }
    } catch (err) {
      errors++;
      console.error("[delinquency-escalation] Error processing invoice", invoice.invoiceId, err instanceof Error ? err.message : err);
    }
  }

  try {
    await emitCloudWatchMetrics(warningCount + suspendedCount + terminatedCount, suspendedCount);
  } catch (err) {
    console.error("[delinquency-escalation] Failed to emit CloudWatch metrics", err instanceof Error ? err.message : err);
  }

  return {
    ok: true,
    processed,
    warningCount,
    suspendedCount,
    terminatedCount,
    errors,
    runAt: nowIso(),
  };
};

async function updateBillingProfileDelinquency(
  agencyId: string,
  tier: "warning" | "suspended" | "terminated",
  reason: string,
): Promise<void> {
  const profileOut = await ddb.send(
    new GetCommand({
      TableName: env.billingProfilesTable,
      Key: { agencyId },
    }),
  );
  if (!profileOut.Item) return;
  const current = (profileOut.Item as { delinquency?: { tier?: string } }).delinquency?.tier ?? "none";
  // Never downgrade tier
  const tierOrder = ["none", "warning", "suspended", "terminated"];
  if (tierOrder.indexOf(current) >= tierOrder.indexOf(tier)) return;

  await ddb.send(
    new UpdateCommand({
      TableName: env.billingProfilesTable,
      Key: { agencyId },
      UpdateExpression: "SET delinquency = :d, updatedAt = :now",
      ExpressionAttributeValues: {
        ":d": { tier, asOf: nowIso(), reason },
        ":now": nowIso(),
      },
    }),
  );
}
