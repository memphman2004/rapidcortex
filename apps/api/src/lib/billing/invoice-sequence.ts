/**
 * Atomic invoice number sequencing (MSA §4.4 / billing-audit H6).
 * Uses a reserved row on the invoices table — no separate meta table required.
 * Format: RC-YYYY-NNNNN (year + 5-digit global sequence).
 */
import { GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { env } from "../env.js";
import { ddb } from "../../repositories/baseRepository.js";

export const INVOICE_SEQUENCE_KEY = "INVOICE_SEQUENCE";

const LEGACY_MONTHLY = /^RC-(\d{4})-(\d{2})-(\d{4})$/;
const YEARLY = /^RC-(\d{4})-(\d{5})$/;

function parseSeqFromNumber(invoiceNumber: string): number {
  const yearly = invoiceNumber.match(YEARLY);
  if (yearly) return Number.parseInt(yearly[2] ?? "0", 10);
  const legacy = invoiceNumber.match(LEGACY_MONTHLY);
  if (legacy) return Number.parseInt(legacy[3] ?? "0", 10);
  return 0;
}

async function seedMaxFromExistingInvoices(): Promise<number> {
  if (!env.invoicesTable?.trim()) return 0;
  let max = 0;
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const out = await ddb.send(
      new ScanCommand({
        TableName: env.invoicesTable,
        ProjectionExpression: "invoiceId, invoiceNumber",
        ExclusiveStartKey,
      }),
    );
    for (const row of out.Items ?? []) {
      const id = String((row as { invoiceId?: string }).invoiceId ?? "");
      if (id === INVOICE_SEQUENCE_KEY) continue;
      const num = String((row as { invoiceNumber?: string }).invoiceNumber ?? "");
      max = Math.max(max, parseSeqFromNumber(num));
    }
    ExclusiveStartKey = out.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return max;
}

async function ensureSequenceRow(): Promise<void> {
  const existing = await ddb.send(
    new GetCommand({
      TableName: env.invoicesTable,
      Key: { invoiceId: INVOICE_SEQUENCE_KEY },
    }),
  );
  if (typeof (existing.Item as { sequence?: number } | undefined)?.sequence === "number") {
    return;
  }
  const historicalMax = await seedMaxFromExistingInvoices();
  try {
    await ddb.send(
      new PutCommand({
        TableName: env.invoicesTable,
        Item: {
          invoiceId: INVOICE_SEQUENCE_KEY,
          agencyId: "__billing_meta__",
          sequence: historicalMax,
          updatedAt: new Date().toISOString(),
        },
        ConditionExpression: "attribute_not_exists(invoiceId)",
      }),
    );
  } catch (error) {
    const name = (error as { name?: string })?.name ?? "";
    if (name !== "ConditionalCheckFailedException") throw error;
  }
}

/**
 * Atomically allocate the next invoice number.
 * `agencyId` is accepted for API compatibility but numbering is global per MSA.
 */
export async function nextInvoiceNumber(
  _agencyId: string,
  invoiceDate: string = new Date().toISOString(),
): Promise<string> {
  if (!env.invoicesTable?.trim()) {
    throw new Error("INVOICES_TABLE is not configured");
  }

  await ensureSequenceRow();

  const year = new Date(invoiceDate).getUTCFullYear();
  const result = await ddb.send(
    new UpdateCommand({
      TableName: env.invoicesTable,
      Key: { invoiceId: INVOICE_SEQUENCE_KEY },
      UpdateExpression: "SET #seq = if_not_exists(#seq, :zero) + :inc, updatedAt = :updatedAt",
      ExpressionAttributeNames: { "#seq": "sequence" },
      ExpressionAttributeValues: {
        ":zero": 0,
        ":inc": 1,
        ":updatedAt": new Date().toISOString(),
      },
      ReturnValues: "UPDATED_NEW",
    }),
  );

  const seq = Number((result.Attributes as { sequence?: number } | undefined)?.sequence ?? 0);
  if (!Number.isFinite(seq) || seq < 1) {
    throw new Error("Failed to allocate invoice sequence");
  }
  return `RC-${year}-${String(seq).padStart(5, "0")}`;
}
