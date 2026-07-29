import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { nextInvoiceNumber } from "../lib/billing/invoice-sequence.js";
import { dollarsToCents } from "../lib/billing/money-cents.js";
import { validatePaymentInstructionsForSend } from "../lib/billing/payment-instructions.js";
import { loadPaymentInstructions } from "../lib/billing/invoicePdfGenerator.js";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { sesConfigurationSetFields } from "../lib/ses/sesConfigurationSet.js";
import { ddb } from "../repositories/baseRepository.js";
import { BillingAuditService } from "./billingAuditService.js";
import { sendInvoiceEmail } from "./billingEmailService.js";
import { generateInvoicePDF } from "./invoicePdfGenerator.js";

type ScheduleFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUALLY";

type BillingScheduleRow = {
  scheduleId: string;
  agencyId?: string;
  customerId?: string;
  serviceId?: string;
  serviceName?: string;
  frequency?: ScheduleFrequency;
  amount?: number;
  /** Optional integer cents; preferred when present. */
  amountCents?: number;
  currency?: string;
  notes?: string;
  enabled?: string;
  autoSendEmail?: boolean;
  nextRunDate?: string;
};

export type ProcessScheduledBillingOptions = {
  /**
   * MSA §4.4 / TODO-6: when true (EventBridge on the 15th), generate next-month
   * invoices with due date = last day of next month (≥15 days lead time).
   */
  advanceMonthly?: boolean;
};

const ses = new SESClient({ region: env.region });
const billingAuditService = new BillingAuditService();

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

function computeNextRunDate(baseDateIso: string, frequency: ScheduleFrequency): string {
  const base = new Date(baseDateIso);
  const next = new Date(base.toISOString());
  switch (frequency) {
    case "WEEKLY":
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case "MONTHLY":
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    case "QUARTERLY":
      next.setUTCMonth(next.getUTCMonth() + 3);
      break;
    case "ANNUALLY":
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      break;
  }
  return next.toISOString();
}

function calculateDueDate(invoiceDateIso: string, days = 30): string {
  const d = new Date(invoiceDateIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/** Next calendar month period (UTC) for 15-day advance invoicing. */
export function nextMonthBillingPeriod(from = new Date()): {
  periodStart: string;
  periodEnd: string;
  dueDate: string;
} {
  const periodStartDate = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
  const periodEndDate = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 2, 0));
  const periodStart = periodStartDate.toISOString().slice(0, 10);
  const periodEnd = periodEndDate.toISOString().slice(0, 10);
  return { periodStart, periodEnd, dueDate: periodEnd };
}

function scheduleAmountDollars(schedule: BillingScheduleRow): number {
  if (typeof schedule.amountCents === "number" && Number.isFinite(schedule.amountCents)) {
    return Number((schedule.amountCents / 100).toFixed(2));
  }
  return Number((schedule.amount ?? 0).toFixed(2));
}

async function sendAdminFailureNotification(subject: string, body: string): Promise<void> {
  const sender = env.billingSesSenderEmail?.trim();
  if (!sender) return;
  await ses.send(
    new SendEmailCommand({
      ...sesConfigurationSetFields(),
      Source: sender,
      Destination: { ToAddresses: [sender] },
      Message: {
        Subject: { Data: subject },
        Body: { Text: { Data: body } },
      },
    }),
  );
}

async function processOneSchedule(
  schedule: BillingScheduleRow,
  options: ProcessScheduledBillingOptions = {},
): Promise<void> {
  if (!schedule.scheduleId || !schedule.customerId || !schedule.serviceName || !schedule.frequency) {
    throw new Error("Schedule missing required fields");
  }
  if (options.advanceMonthly && schedule.frequency !== "MONTHLY") {
    return;
  }

  const customerOut = await ddb.send(
    new GetCommand({
      TableName: env.customersTable,
      Key: { customerId: schedule.customerId },
    }),
  );
  const customer = customerOut.Item as
    | {
        customerId?: string;
        agencyId?: string;
        agencyName?: string;
        billingContact?: string;
        email?: string;
        address?: string;
        paymentTerms?: string;
      }
    | undefined;
  if (!customer?.customerId) throw new Error("Customer not found for schedule");

  if (schedule.serviceId) {
    const serviceOut = await ddb.send(
      new GetCommand({
        TableName: env.serviceCatalogTable,
        Key: { serviceId: schedule.serviceId },
      }),
    );
    if (!serviceOut.Item) throw new Error("Service not found for schedule");
  }

  const t = nowIso();
  const invoiceId = makeId("inv");
  const invoiceDate = t;
  const advancePeriod = options.advanceMonthly ? nextMonthBillingPeriod() : null;
  const dueDate = advancePeriod ? `${advancePeriod.dueDate}T00:00:00.000Z` : calculateDueDate(invoiceDate, 30);
  const invoiceNumber = await nextInvoiceNumber(
    schedule.agencyId ?? customer.agencyId ?? schedule.customerId,
    invoiceDate,
  );
  const amount = scheduleAmountDollars(schedule);
  const amountCents = typeof schedule.amountCents === "number" ? schedule.amountCents : dollarsToCents(amount);
  const currency = (schedule.currency ?? "USD").toUpperCase();

  await ddb.send(
    new PutCommand({
      TableName: env.invoicesTable,
      Item: {
        invoiceId,
        agencyId: schedule.agencyId ?? customer.agencyId,
        customerId: schedule.customerId,
        invoiceNumber,
        status: "DRAFT",
        subtotal: amount,
        discount: 0,
        tax: 0,
        total: amount,
        subtotalCents: amountCents,
        discountCents: 0,
        taxCents: 0,
        totalCents: amountCents,
        currency,
        invoiceDate,
        dueDate,
        periodStart: advancePeriod?.periodStart,
        periodEnd: advancePeriod?.periodEnd,
        notes: schedule.notes,
        createdBy: options.advanceMonthly ? "billing-advance-monthly" : "billing-schedule-processor",
        createdAt: t,
        updatedAt: t,
        billingScheduleId: schedule.scheduleId,
        advanceGenerated: Boolean(options.advanceMonthly),
      },
    }),
  );

  await ddb.send(
    new PutCommand({
      TableName: env.invoiceItemsTable,
      Item: {
        invoiceItemId: makeId("invitem"),
        invoiceId,
        agencyId: schedule.agencyId ?? customer.agencyId,
        serviceId: schedule.serviceId,
        serviceName: schedule.serviceName,
        description: advancePeriod
          ? `Recurring scheduled billing (${advancePeriod.periodStart} → ${advancePeriod.periodEnd})`
          : (schedule.notes ?? "Recurring scheduled billing"),
        quantity: 1,
        unitPrice: amount,
        unitPriceCents: amountCents,
        lineTotal: amount,
        lineTotalCents: amountCents,
        sortOrder: 0,
        createdAt: t,
      },
    }),
  );

  const pdf = await generateInvoicePDF(
    {
      invoiceId,
      invoiceNumber,
      invoiceDate,
      dueDate,
      subtotal: amount,
      discount: 0,
      tax: 0,
      total: amount,
      currency,
      paymentTerms: customer.paymentTerms,
    },
    {
      customerId: schedule.customerId,
      agencyName: customer.agencyName ?? "Customer",
      billingContact: customer.billingContact,
      email: customer.email,
      address: customer.address,
    },
    [
      {
        serviceName: schedule.serviceName,
        description: schedule.notes ?? "Recurring service charge",
        quantity: 1,
        unitPrice: amount,
        total: amount,
      },
    ],
  );

  await ddb.send(
    new UpdateCommand({
      TableName: env.invoicesTable,
      Key: { invoiceId },
      UpdateExpression: "SET pdfS3Key = :pdfS3Key, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":pdfS3Key": pdf.s3Key,
        ":updatedAt": nowIso(),
      },
    }),
  );

  if (schedule.autoSendEmail && customer.email) {
    validatePaymentInstructionsForSend(await loadPaymentInstructions());
    await sendInvoiceEmail(invoiceId, customer.email, []);
    await ddb.send(
      new UpdateCommand({
        TableName: env.invoicesTable,
        Key: { invoiceId },
        UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":status": "SENT",
          ":updatedAt": nowIso(),
        },
      }),
    );
  }

  const runAt = nowIso();
  const nextRunDate = options.advanceMonthly
    ? computeNextRunDate(advancePeriod!.periodStart, schedule.frequency)
    : computeNextRunDate(runAt, schedule.frequency);
  await ddb.send(
    new UpdateCommand({
      TableName: env.billingSchedulesTable,
      Key: { scheduleId: schedule.scheduleId },
      UpdateExpression: "SET lastRunDate = :lastRunDate, nextRunDate = :nextRunDate, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":lastRunDate": runAt,
        ":nextRunDate": nextRunDate,
        ":updatedAt": runAt,
      },
    }),
  );

  await billingAuditService.logBillingAction(
    options.advanceMonthly ? "advance_schedule_executed" : "schedule_executed",
    "schedule",
    schedule.scheduleId,
    "billing-schedule-processor",
    {
      agencyId: schedule.agencyId ?? customer.agencyId,
      customerId: schedule.customerId,
      invoiceId,
      nextRunDate,
      autoSendEmail: Boolean(schedule.autoSendEmail),
      advanceMonthly: Boolean(options.advanceMonthly),
      periodStart: advancePeriod?.periodStart,
      periodEnd: advancePeriod?.periodEnd,
    },
  );
}

export async function processScheduledBilling(
  options: ProcessScheduledBillingOptions = {},
): Promise<{
  scanned: number;
  processed: number;
  failed: number;
  mode: "daily" | "advance_monthly";
}> {
  const now = nowIso();
  const out = await ddb.send(
    new QueryCommand({
      TableName: env.billingSchedulesTable,
      IndexName: "enabled-nextRunDate-index",
      KeyConditionExpression: "enabled = :enabled AND nextRunDate <= :today",
      ExpressionAttributeValues: {
        ":enabled": "true",
        ":today": now,
      },
    }),
  );
  let schedules = (out.Items ?? []) as BillingScheduleRow[];
  if (options.advanceMonthly) {
    // Also pick up monthly schedules whose next run is within the upcoming month window.
    const period = nextMonthBillingPeriod();
    const lookahead = await ddb.send(
      new QueryCommand({
        TableName: env.billingSchedulesTable,
        IndexName: "enabled-nextRunDate-index",
        KeyConditionExpression: "enabled = :enabled AND nextRunDate <= :periodEnd",
        ExpressionAttributeValues: {
          ":enabled": "true",
          ":periodEnd": `${period.periodEnd}T23:59:59.999Z`,
        },
      }),
    );
    const byId = new Map<string, BillingScheduleRow>();
    for (const row of [...schedules, ...((lookahead.Items ?? []) as BillingScheduleRow[])]) {
      if (row.scheduleId && row.frequency === "MONTHLY") byId.set(row.scheduleId, row);
    }
    schedules = [...byId.values()];
  }

  let processed = 0;
  let failed = 0;

  for (const schedule of schedules) {
    try {
      await processOneSchedule(schedule, options);
      processed += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Unknown error";
      await billingAuditService.logBillingAction(
        "schedule_execution_failed",
        "schedule",
        schedule.scheduleId ?? "unknown",
        "billing-schedule-processor",
        {
          agencyId: schedule.agencyId,
          customerId: schedule.customerId,
          error: message,
          advanceMonthly: Boolean(options.advanceMonthly),
        },
      );
      await sendAdminFailureNotification(
        `Billing schedule failed: ${schedule.scheduleId ?? "unknown"}`,
        `Schedule execution failed.\nSchedule: ${schedule.scheduleId ?? "unknown"}\nCustomer: ${schedule.customerId ?? "unknown"}\nError: ${message}\nDate: ${todayIsoDate()}`,
      );
    }
  }

  return {
    scanned: schedules.length,
    processed,
    failed,
    mode: options.advanceMonthly ? "advance_monthly" : "daily",
  };
}
