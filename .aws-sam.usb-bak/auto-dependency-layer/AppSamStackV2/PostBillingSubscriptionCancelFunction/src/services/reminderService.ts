import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { env } from "../lib/env.js";
import { ddb } from "../repositories/baseRepository.js";
import { sendReminderEmail } from "./billingEmailService.js";

type ReminderType = "3_DAYS_BEFORE" | "DUE_TODAY" | "7_DAYS_OVERDUE" | "15_DAYS_OVERDUE" | "30_DAYS_OVERDUE";

type InvoiceRow = {
  invoiceId: string;
  status?: string;
  dueDate?: string;
  agencyId?: string;
  customerId?: string;
  reminderHistory?: Record<string, string>;
};

function toUtcDateOnly(input: string): Date | null {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function daysFromTodayToDueDate(dueDate: string, today = new Date()): number | null {
  const due = toUtcDateOnly(dueDate);
  if (!due) return null;
  const now = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const ms = due.getTime() - now.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function determineReminderType(daysUntilDue: number): ReminderType | null {
  if (daysUntilDue === 3) return "3_DAYS_BEFORE";
  if (daysUntilDue === 0) return "DUE_TODAY";
  if (daysUntilDue === -7) return "7_DAYS_OVERDUE";
  if (daysUntilDue === -15) return "15_DAYS_OVERDUE";
  if (daysUntilDue === -30) return "30_DAYS_OVERDUE";
  return null;
}

function wasReminderAlreadySent(invoice: InvoiceRow, reminderType: ReminderType): boolean {
  const history = invoice.reminderHistory ?? {};
  return Boolean(history[reminderType]);
}

async function markReminderSent(invoiceId: string, reminderType: ReminderType, sentAt: string): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: env.invoicesTable,
      Key: { invoiceId },
      UpdateExpression:
        "SET reminderHistory.#type = :sentAt, lastReminderType = :type, lastReminderSentAt = :sentAt, reminderEmailCount = if_not_exists(reminderEmailCount, :zero) + :one, updatedAt = :updatedAt",
      ExpressionAttributeNames: {
        "#type": reminderType,
      },
      ExpressionAttributeValues: {
        ":type": reminderType,
        ":sentAt": sentAt,
        ":updatedAt": sentAt,
        ":zero": 0,
        ":one": 1,
      },
    }),
  );
}

export async function checkAndSendReminders(): Promise<{
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
}> {
  const out = await ddb.send(
    new ScanCommand({
      TableName: env.invoicesTable,
      FilterExpression: "#status = :sent OR #status = :overdue",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":sent": "SENT",
        ":overdue": "OVERDUE",
      },
    }),
  );

  const invoices = (out.Items ?? []) as InvoiceRow[];
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const invoice of invoices) {
    if (!invoice.invoiceId || !invoice.dueDate) {
      skipped += 1;
      continue;
    }
    const daysUntilDue = daysFromTodayToDueDate(invoice.dueDate);
    if (daysUntilDue == null) {
      skipped += 1;
      continue;
    }

    const reminderType = determineReminderType(daysUntilDue);
    if (!reminderType) {
      skipped += 1;
      continue;
    }
    if (wasReminderAlreadySent(invoice, reminderType)) {
      skipped += 1;
      continue;
    }

    try {
      const result = await sendReminderEmail(invoice.invoiceId, reminderType);
      await markReminderSent(invoice.invoiceId, reminderType, result.sentAt);
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    scanned: invoices.length,
    sent,
    skipped,
    failed,
  };
}
