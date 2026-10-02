/**
 * Per-agency invoice generator (SQS FIFO consumer).
 * Idempotent on agencyId + billingPeriod for non-voided invoices.
 */

import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import type { SQSHandler } from "aws-lambda";
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import {
  computeInvoice,
  emptyUsageSnapshot,
  parseBillingPeriod,
  type AgencyBillingConfig,
  type AutomatedInvoice,
  type MonthlyUsageSnapshot,
} from "rapid-cortex-shared";
import { env } from "../../lib/env.js";
import { ddb } from "../../repositories/baseRepository.js";
import { writeAutomatedBillingAudit } from "./audit.js";
import { sendAutomatedInvoiceEmail } from "./invoice-emailer.js";
import {
  agencyBillingConfigsTable,
  automatedInvoicesTable,
  billingRunsTable,
  usageSnapshotsTable,
} from "./tables.js";

type Job = { agencyId: string; billingPeriod: string; runId: string };

export const handler: SQSHandler = async (event) => {
  const failures: { itemIdentifier: string }[] = [];
  for (const record of event.Records) {
    try {
      const job = JSON.parse(record.body) as Job;
      if (!job.agencyId || !job.billingPeriod) {
        throw new Error("Invalid invoice job payload");
      }
      await generateForAgency(job);
    } catch (err) {
      console.error(
        JSON.stringify({
          level: "ERROR",
          event: "INVOICE_GENERATE_FAILED",
          messageId: record.messageId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      failures.push({ itemIdentifier: record.messageId });
      try {
        const job = JSON.parse(record.body) as Job;
        await bumpRun(job.runId, "failed", job.agencyId, err instanceof Error ? err.message : String(err));
      } catch {
        /* run counter is best-effort */
      }
    }
  }
  return { batchItemFailures: failures };
};

async function generateForAgency(job: Job): Promise<void> {
  const configRes = await ddb.send(
    new GetCommand({
      TableName: agencyBillingConfigsTable(),
      Key: { agencyId: job.agencyId },
    }),
  );
  const config = configRes.Item as AgencyBillingConfig | undefined;
  if (!config || config.agencyId !== job.agencyId) {
    throw new Error(`Billing config not found for ${job.agencyId}`);
  }
  if (config.status !== "active" && config.status !== "pilot") {
    console.log(JSON.stringify({ level: "INFO", event: "INVOICE_SKIP_INACTIVE", agencyId: job.agencyId }));
    return;
  }

  const existing = await ddb.send(
    new QueryCommand({
      TableName: automatedInvoicesTable(),
      IndexName: "agencyId-billingPeriod-index",
      KeyConditionExpression: "agencyId = :a AND billingPeriod = :p",
      ExpressionAttributeValues: { ":a": job.agencyId, ":p": job.billingPeriod },
    }),
  );
  const live = (existing.Items ?? []).filter((row) => (row as AutomatedInvoice).status !== "voided") as AutomatedInvoice[];
  if (live.length > 0) {
    console.log(
      JSON.stringify({
        level: "INFO",
        event: "INVOICE_SKIP_EXISTS",
        agencyId: job.agencyId,
        billingPeriod: job.billingPeriod,
        invoiceId: live[0]?.invoiceId,
      }),
    );
    await bumpRun(job.runId, "processed");
    return;
  }

  const snapRes = await ddb.send(
    new GetCommand({
      TableName: usageSnapshotsTable(),
      Key: { agencyId: job.agencyId, billingPeriod: job.billingPeriod },
    }),
  );
  const usage =
    (snapRes.Item as MonthlyUsageSnapshot | undefined) ??
    emptyUsageSnapshot(job.agencyId, job.billingPeriod, {
      dispatcher: config.contractedDispatcherSeats,
      admin: config.contractedAdminSeats,
    });
  if (usage.agencyId !== job.agencyId || usage.billingPeriod !== job.billingPeriod) {
    throw new Error("Usage snapshot agency/period mismatch");
  }

  const sequenceNumber =
    ((existing.Items ?? []) as AutomatedInvoice[]).reduce((max, row) => Math.max(max, row.sequenceNumber ?? 0), 0) + 1;

  const invoice = computeInvoice({
    config,
    usage,
    period: parseBillingPeriod(job.billingPeriod),
    sequenceNumber,
  });

  try {
    await ddb.send(
      new PutCommand({
        TableName: automatedInvoicesTable(),
        Item: invoice,
        ConditionExpression: "attribute_not_exists(invoiceId)",
      }),
    );
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      await bumpRun(job.runId, "processed");
      return;
    }
    throw err;
  }

  await writeAutomatedBillingAudit({
    agencyId: invoice.agencyId,
    actorId: "system:invoice-generator",
    type: AUDIT_EVENT_TYPES.AUTOMATED_INVOICE_GENERATED,
    invoiceId: invoice.invoiceId,
    details: { billingPeriod: invoice.billingPeriod, totalCents: invoice.totalCents, runId: job.runId },
  });

  if (env.autoSendInvoices) {
    const result = await sendAutomatedInvoiceEmail(invoice);
    if (result.sent) {
      const now = new Date().toISOString();
      await ddb.send(
        new UpdateCommand({
          TableName: automatedInvoicesTable(),
          Key: { invoiceId: invoice.invoiceId },
          UpdateExpression: "SET #st = :sent, emailSentAt = :now, updatedAt = :now",
          ConditionExpression: "agencyId = :a",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: { ":sent": "sent", ":now": now, ":a": invoice.agencyId },
        }),
      );
      await writeAutomatedBillingAudit({
        agencyId: invoice.agencyId,
        actorId: "system:invoice-generator",
        type: AUDIT_EVENT_TYPES.AUTOMATED_INVOICE_SENT,
        invoiceId: invoice.invoiceId,
      });
    }
  }

  await bumpRun(job.runId, "processed");
}

async function bumpRun(
  runId: string | undefined,
  field: "processed" | "failed",
  agencyId?: string,
  error?: string,
): Promise<void> {
  if (!runId) return;
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: billingRunsTable(),
        Key: { runId },
        UpdateExpression:
          field === "failed" && agencyId
            ? "ADD #f :one SET errors = list_append(if_not_exists(errors, :empty), :err)"
            : `ADD #f :one`,
        ExpressionAttributeNames: { "#f": field },
        ExpressionAttributeValues: {
          ":one": 1,
          ...(field === "failed" && agencyId
            ? { ":empty": [], ":err": [{ agencyId, error: error ?? "unknown" }] }
            : {}),
        },
      }),
    );
  } catch (err) {
    console.warn(
      JSON.stringify({
        level: "WARN",
        event: "BILLING_RUN_COUNTER_FAILED",
        runId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
