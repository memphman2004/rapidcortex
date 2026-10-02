/**
 * Last-day-of-month orchestrator.
 * Queries active/pilot billing configs and enqueues one SQS FIFO message per agency.
 * Period is computed in America/New_York so DST does not shift the billed month.
 */

import { SQSClient, SendMessageBatchCommand, type SendMessageBatchRequestEntry } from "@aws-sdk/client-sqs";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { currentBillingPeriodEt, formatBillingPeriod, type AgencyBillingConfig } from "rapid-cortex-shared";
import { env } from "../../lib/env.js";
import { ddb } from "../../repositories/baseRepository.js";
import { agencyBillingConfigsTable, billingRunsTable } from "./tables.js";

const sqs = new SQSClient({ region: env.region });

export async function handler(): Promise<{ runId: string; billed: number; period: string }> {
  if (!env.enableAutomatedInvoices) {
    console.log(JSON.stringify({ level: "INFO", event: "AUTOMATED_INVOICES_DISABLED" }));
    return { runId: "", billed: 0, period: "" };
  }

  const period = currentBillingPeriodEt();
  const periodStr = formatBillingPeriod(period);
  const runId = `billing-run-${periodStr}-${Date.now()}`;
  const queueUrl = process.env.INVOICE_JOBS_QUEUE_URL?.trim();
  if (!queueUrl) throw new Error("Missing INVOICE_JOBS_QUEUE_URL");

  const agencies = [
    ...(await queryConfigsByStatus("active")),
    ...(await queryConfigsByStatus("pilot")),
  ];

  await ddb.send(
    new PutCommand({
      TableName: billingRunsTable(),
      Item: {
        runId,
        billingPeriod: periodStr,
        startedAt: new Date().toISOString(),
        totalAgencies: agencies.length,
        processed: 0,
        failed: 0,
        errors: [],
        status: "running",
      },
    }),
  );

  console.log(
    JSON.stringify({
      level: "INFO",
      event: "BILLING_RUN_START",
      runId,
      periodStr,
      totalAgencies: agencies.length,
      userId: "system:billing-orchestrator",
    }),
  );

  for (let i = 0; i < agencies.length; i += 10) {
    const chunk = agencies.slice(i, i + 10);
    const Entries: SendMessageBatchRequestEntry[] = chunk.map((agency, idx) => ({
      Id: String(idx),
      MessageBody: JSON.stringify({
        agencyId: agency.agencyId,
        billingPeriod: periodStr,
        runId,
      }),
      MessageGroupId: sanitizeFifoToken(agency.agencyId).slice(0, 128),
      MessageDeduplicationId: sanitizeFifoToken(`${periodStr}-${agency.agencyId}`).slice(0, 128),
    }));
    await sqs.send(new SendMessageBatchCommand({ QueueUrl: queueUrl, Entries }));
  }

  return { runId, billed: agencies.length, period: periodStr };
}

async function queryConfigsByStatus(status: "active" | "pilot"): Promise<AgencyBillingConfig[]> {
  const items: AgencyBillingConfig[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: agencyBillingConfigsTable(),
        IndexName: "status-index",
        KeyConditionExpression: "#st = :st",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: { ":st": status },
        ExclusiveStartKey,
      }),
    );
    for (const item of res.Items ?? []) {
      items.push(item as AgencyBillingConfig);
    }
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

function sanitizeFifoToken(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "-");
}
