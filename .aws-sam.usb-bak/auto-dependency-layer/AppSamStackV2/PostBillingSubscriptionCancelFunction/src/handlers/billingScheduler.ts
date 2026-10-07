import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { ddb } from "../repositories/baseRepository.js";
import { env } from "../lib/env.js";
import { processScheduledBilling } from "../services/billingScheduleProcessor.js";
import { checkAndSendReminders } from "../services/reminderService.js";

const ses = new SESClient({ region: env.region });

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function updateOverdueInvoices(): Promise<number> {
  const today = todayIsoDate();
  const out = await ddb.send(
    new ScanCommand({
      TableName: env.invoicesTable,
      FilterExpression: "#status = :sent AND dueDate < :today",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":sent": "SENT",
        ":today": today,
      },
    }),
  );
  const invoices = (out.Items ?? []) as Array<{ invoiceId?: string }>;
  let updated = 0;
  for (const invoice of invoices) {
    if (!invoice.invoiceId) continue;
    await ddb.send(
      new UpdateCommand({
        TableName: env.invoicesTable,
        Key: { invoiceId: invoice.invoiceId },
        UpdateExpression: "SET #status = :status, overdueSince = :overdueSince, updatedAt = :updatedAt",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":status": "OVERDUE",
          ":overdueSince": today,
          ":updatedAt": new Date().toISOString(),
        },
      }),
    );
    updated += 1;
  }
  return updated;
}

async function sendDailyBillingSummary(summary: {
  scheduledScanned: number;
  scheduledProcessed: number;
  scheduledFailed: number;
  remindersScanned: number;
  remindersSent: number;
  remindersFailed: number;
  overdueUpdated: number;
}): Promise<void> {
  const sender = env.billingSesSenderEmail?.trim();
  if (!sender) return;
  const subject = `Daily Billing Scheduler Summary - ${todayIsoDate()}`;
  const body = [
    `Scheduled billing scanned: ${summary.scheduledScanned}`,
    `Scheduled billing processed: ${summary.scheduledProcessed}`,
    `Scheduled billing failed: ${summary.scheduledFailed}`,
    `Reminders scanned: ${summary.remindersScanned}`,
    `Reminders sent: ${summary.remindersSent}`,
    `Reminders failed: ${summary.remindersFailed}`,
    `Overdue invoices updated: ${summary.overdueUpdated}`,
  ].join("\n");
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

export const handler = async () => {
  const scheduled = await processScheduledBilling();
  const reminders = await checkAndSendReminders();
  const overdueUpdated = await updateOverdueInvoices();
  await sendDailyBillingSummary({
    scheduledScanned: scheduled.scanned,
    scheduledProcessed: scheduled.processed,
    scheduledFailed: scheduled.failed,
    remindersScanned: reminders.scanned,
    remindersSent: reminders.sent,
    remindersFailed: reminders.failed,
    overdueUpdated,
  });
  return {
    ok: true,
    scheduled,
    reminders,
    overdueUpdated,
    runAt: new Date().toISOString(),
  };
};
