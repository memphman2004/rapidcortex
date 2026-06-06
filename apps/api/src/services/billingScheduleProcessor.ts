import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
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
  currency?: string;
  notes?: string;
  enabled?: string;
  autoSendEmail?: boolean;
  nextRunDate?: string;
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

async function nextInvoiceNumber(agencyId: string, invoiceDate: string): Promise<string> {
  const d = new Date(invoiceDate);
  const yyyy = d.getUTCFullYear();
  const mm = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  const prefix = `${yyyy}-${mm}`;
  const out = await ddb.send(
    new QueryCommand({
      TableName: env.invoicesTable,
      IndexName: "customerId-createdAt-index",
      KeyConditionExpression: "customerId = :customerId",
      ExpressionAttributeValues: { ":customerId": agencyId },
      Limit: 1,
    }),
  );
  const items = (out.Items ?? []) as Array<{ invoiceNumber?: string }>;
  const max = items.reduce((m, row) => {
    const match = (row.invoiceNumber ?? "").match(/^RC-(\d{4}-\d{2})-(\d{4})$/);
    if (!match || match[1] !== prefix) return m;
    return Math.max(m, Number.parseInt(match[2] ?? "0", 10));
  }, 0);
  return `RC-${prefix}-${`${max + 1}`.padStart(4, "0")}`;
}

async function sendAdminFailureNotification(subject: string, body: string): Promise<void> {
  const sender = env.billingSesSenderEmail?.trim();
  if (!sender) return;
  await ses.send(
    new SendEmailCommand({
      Source: sender,
      Destination: { ToAddresses: [sender] },
      Message: {
        Subject: { Data: subject },
        Body: { Text: { Data: body } },
      },
    }),
  );
}

async function processOneSchedule(schedule: BillingScheduleRow): Promise<void> {
  if (!schedule.scheduleId || !schedule.customerId || !schedule.serviceName || !schedule.frequency) {
    throw new Error("Schedule missing required fields");
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
  const dueDate = calculateDueDate(invoiceDate, 30);
  const invoiceNumber = await nextInvoiceNumber(schedule.agencyId ?? customer.agencyId ?? schedule.customerId, invoiceDate);
  const amount = Number((schedule.amount ?? 0).toFixed(2));
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
        currency,
        invoiceDate,
        dueDate,
        notes: schedule.notes,
        createdBy: "billing-schedule-processor",
        createdAt: t,
        updatedAt: t,
        billingScheduleId: schedule.scheduleId,
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
        description: schedule.notes ?? "Recurring scheduled billing",
        quantity: 1,
        unitPrice: amount,
        lineTotal: amount,
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
  const nextRunDate = computeNextRunDate(runAt, schedule.frequency);
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

  await billingAuditService.logBillingAction("schedule_executed", "schedule", schedule.scheduleId, "billing-schedule-processor", {
    agencyId: schedule.agencyId ?? customer.agencyId,
    customerId: schedule.customerId,
    invoiceId,
    nextRunDate,
    autoSendEmail: Boolean(schedule.autoSendEmail),
  });
}

export async function processScheduledBilling(): Promise<{
  scanned: number;
  processed: number;
  failed: number;
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
  const schedules = (out.Items ?? []) as BillingScheduleRow[];
  let processed = 0;
  let failed = 0;

  for (const schedule of schedules) {
    try {
      await processOneSchedule(schedule);
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
  };
}
