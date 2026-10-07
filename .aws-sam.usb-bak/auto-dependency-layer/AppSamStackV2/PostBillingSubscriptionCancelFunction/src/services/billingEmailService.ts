import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { env } from "../lib/env.js";
import { loadPaymentInstructions } from "../lib/billing/invoicePdfGenerator.js";
import { ddb } from "../repositories/baseRepository.js";
import { BillingAuditService } from "./billingAuditService.js";

const ses = new SESClient({ region: env.region });
const s3 = new S3Client({ region: env.region });
const billingAuditService = new BillingAuditService();

type ReminderType = "3_DAYS_BEFORE" | "DUE_TODAY" | "7_DAYS_OVERDUE" | "15_DAYS_OVERDUE" | "30_DAYS_OVERDUE";

function requireSenderEmail(): string {
  const sender = env.billingSesSenderEmail?.trim();
  if (!sender) throw new Error("BILLING_SES_SENDER_EMAIL is required");
  return sender;
}

function money(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

function brandedHtml(content: string): string {
  const logoSrc = `${env.publicMarketingSiteOrigin.replace(/\/$/, "")}/Rapid911_512.png`;
  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#172b4d;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f7fb;padding:24px 0;">
      <tr>
        <td align="center">
          <table width="640" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #dfe7f3;">
            <tr>
              <td style="background:#0f172a;padding:22px 24px;text-align:center;border-bottom:1px solid #334155;">
                <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
                  <tr>
                    <td style="padding-right:14px;vertical-align:middle;">
                      <img src="${logoSrc}" width="48" height="48" alt="Rapid Cortex" style="display:block;width:48px;height:48px;border-radius:10px;border:0;line-height:0;object-fit:contain;" />
                    </td>
                    <td style="vertical-align:middle;text-align:left;">
                      <div style="color:#f8fafc;font-size:20px;font-weight:700;line-height:1.25;">Rapid Cortex</div>
                      <div style="color:#94a3b8;font-size:13px;line-height:1.35;margin-top:4px;font-weight:600;">Billing notification</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                ${content}
              </td>
            </tr>
            <tr>
              <td style="background:#f8fbff;padding:16px 24px;font-size:12px;color:#4d5b75;">
                Support: <a href="mailto:support@appsondemand.net">support@appsondemand.net</a><br/>
                Apps on Demand LLC, Columbus, GA
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function paymentInstructionsHtml(paymentInfo: {
  achRoutingNumber?: string;
  achAccountNumber?: string;
  wireInstructions?: string;
  checkMailingAddress?: string;
  bankName?: string;
}): string {
  const bank = paymentInfo.bankName ?? "Navy Federal Credit Union";
  const achRouting = paymentInfo.achRoutingNumber ?? "XXX-XXX-XXX";
  const achAccount = paymentInfo.achAccountNumber ?? "XXX-XXX-XXX";
  const wire = paymentInfo.wireInstructions ?? "SWIFT: XXXXXXXX / Account: XXX-XXX-XXX";
  const checkAddress = paymentInfo.checkMailingAddress ?? "123 Main Street, Columbus, GA 31901";
  return `
    <p style="margin:18px 0 6px 0;"><b>Payment Instructions</b></p>
    <p style="margin:0 0 6px 0;"><b>ACH Payment</b><br/>Bank: ${bank}<br/>Routing: ${achRouting}<br/>Account: ${achAccount}<br/>Account Name: Apps on Demand LLC</p>
    <p style="margin:0 0 6px 0;"><b>Wire Transfer</b><br/>${wire}<br/>Beneficiary: Apps on Demand LLC</p>
    <p style="margin:0 0 16px 0;"><b>Check Payment</b><br/>Make payable to: Apps on Demand LLC<br/>Mail to: ${checkAddress}</p>
  `;
}

async function signedInvoicePdfUrl(pdfS3Key?: string): Promise<string | null> {
  if (!pdfS3Key) return null;
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: env.billingInvoicesBucket,
      Key: pdfS3Key,
    }),
    { expiresIn: 900 },
  );
}

export async function sendInvoiceEmail(
  invoiceId: string,
  toEmail: string,
  ccEmails: string[] = [],
): Promise<{ sent: true; sentAt: string }> {
  const sender = requireSenderEmail();
  const invoiceOut = await ddb.send(new GetCommand({ TableName: env.invoicesTable, Key: { invoiceId } }));
  const invoice = invoiceOut.Item as
    | {
        invoiceId: string;
        agencyId?: string;
        customerId?: string;
        invoiceNumber?: string;
        invoiceDate?: string;
        dueDate?: string;
        subtotal?: number;
        discount?: number;
        tax?: number;
        total?: number;
        currency?: string;
        poNumber?: string;
        paymentTerms?: string;
        pdfS3Key?: string;
      }
    | undefined;
  if (!invoice?.invoiceId) throw new Error("Invoice not found");

  const customerOut = await ddb.send(
    new GetCommand({ TableName: env.customersTable, Key: { customerId: invoice.customerId } }),
  );
  const customer = customerOut.Item as { agencyName?: string; billingContact?: string } | undefined;
  const pdfUrl = await signedInvoicePdfUrl(invoice.pdfS3Key);
  const paymentInfo = await loadPaymentInstructions();

  const html = brandedHtml(`
    <h2 style="margin:0 0 10px 0;">Invoice ${invoice.invoiceNumber ?? invoice.invoiceId}</h2>
    <p style="margin:0 0 16px 0;">Hello ${customer?.billingContact ?? customer?.agencyName ?? "Customer"}, your invoice is now available.</p>
    <table cellpadding="6" cellspacing="0" style="font-size:14px;border-collapse:collapse;">
      <tr><td><b>Invoice Date</b></td><td>${invoice.invoiceDate ?? "-"}</td></tr>
      <tr><td><b>Due Date</b></td><td>${invoice.dueDate ?? "-"}</td></tr>
      <tr><td><b>PO Number</b></td><td>${invoice.poNumber ?? "-"}</td></tr>
      <tr><td><b>Subtotal</b></td><td>${money(Number(invoice.subtotal ?? 0), invoice.currency ?? "USD")}</td></tr>
      <tr><td><b>Discount</b></td><td>${money(Number(invoice.discount ?? 0), invoice.currency ?? "USD")}</td></tr>
      <tr><td><b>Tax</b></td><td>${money(Number(invoice.tax ?? 0), invoice.currency ?? "USD")}</td></tr>
      <tr><td><b>Total Due</b></td><td><b>${money(Number(invoice.total ?? 0), invoice.currency ?? "USD")}</b></td></tr>
    </table>
    ${paymentInstructionsHtml(paymentInfo)}
    <p style="margin:0 0 16px 0;">Terms: ${invoice.paymentTerms ?? "NET 30"}.</p>
    ${
      pdfUrl
        ? `<p style="margin:0;"><a href="${pdfUrl}" style="display:inline-block;background:#0f2f64;color:#fff;text-decoration:none;padding:10px 14px;border-radius:6px;">Download Invoice PDF</a></p>`
        : `<p style="margin:0;">Invoice PDF will be available shortly.</p>`
    }
  `);

  await ses.send(
    new SendEmailCommand({
      Source: sender,
      Destination: {
        ToAddresses: [toEmail],
        CcAddresses: ccEmails.filter(Boolean),
      },
      Message: {
        Subject: { Data: `Rapid Cortex Invoice ${invoice.invoiceNumber ?? invoice.invoiceId}` },
        Body: { Html: { Data: html } },
      },
    }),
  );

  const sentAt = new Date().toISOString();
  await ddb.send(
    new UpdateCommand({
      TableName: env.invoicesTable,
      Key: { invoiceId },
      UpdateExpression: "SET emailedAt = :emailedAt, emailedTo = :emailedTo, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":emailedAt": sentAt,
        ":emailedTo": toEmail,
        ":updatedAt": sentAt,
      },
    }),
  );
  await billingAuditService.logBillingAction("invoice_email_sent", "invoice", invoiceId, "system", {
    agencyId: invoice.agencyId,
    customerId: invoice.customerId,
    invoiceId,
    toEmail,
    ccEmails,
  });
  return { sent: true, sentAt };
}

export async function sendPaymentConfirmationEmail(paymentId: string): Promise<{ sent: true; sentAt: string }> {
  const sender = requireSenderEmail();
  const paymentOut = await ddb.send(new GetCommand({ TableName: env.paymentRecordsTable, Key: { paymentId } }));
  const payment = paymentOut.Item as
    | {
        paymentId: string;
        agencyId?: string;
        customerId?: string;
        invoiceId?: string;
        amount?: number;
        currency?: string;
        paymentDate?: string;
      }
    | undefined;
  if (!payment?.paymentId) throw new Error("Payment not found");

  const invoiceOut = await ddb.send(new GetCommand({ TableName: env.invoicesTable, Key: { invoiceId: payment.invoiceId } }));
  const invoice = invoiceOut.Item as { invoiceNumber?: string; pdfS3Key?: string } | undefined;
  const customerOut = await ddb.send(
    new GetCommand({ TableName: env.customersTable, Key: { customerId: payment.customerId } }),
  );
  const customer = customerOut.Item as { email?: string; agencyName?: string; billingContact?: string } | undefined;
  if (!customer?.email) throw new Error("Customer email not found");

  const pdfUrl = await signedInvoicePdfUrl(invoice?.pdfS3Key);
  const paymentInfo = await loadPaymentInstructions();
  const html = brandedHtml(`
    <h2 style="margin:0 0 10px 0;">Payment Received</h2>
    <p style="margin:0 0 16px 0;">Hello ${customer.billingContact ?? customer.agencyName ?? "Customer"}, we received your payment.</p>
    <table cellpadding="6" cellspacing="0" style="font-size:14px;border-collapse:collapse;">
      <tr><td><b>Invoice</b></td><td>${invoice?.invoiceNumber ?? payment.invoiceId ?? "-"}</td></tr>
      <tr><td><b>Payment Date</b></td><td>${payment.paymentDate ?? "-"}</td></tr>
      <tr><td><b>Amount</b></td><td><b>${money(Number(payment.amount ?? 0), payment.currency ?? "USD")}</b></td></tr>
    </table>
    ${paymentInstructionsHtml(paymentInfo)}
    ${
      pdfUrl
        ? `<p style="margin:16px 0 0 0;"><a href="${pdfUrl}" style="display:inline-block;background:#0f2f64;color:#fff;text-decoration:none;padding:10px 14px;border-radius:6px;">Download Invoice PDF</a></p>`
        : ""
    }
  `);

  await ses.send(
    new SendEmailCommand({
      Source: sender,
      Destination: { ToAddresses: [customer.email] },
      Message: {
        Subject: { Data: `Payment Confirmation - ${invoice?.invoiceNumber ?? payment.invoiceId}` },
        Body: { Html: { Data: html } },
      },
    }),
  );

  const sentAt = new Date().toISOString();
  await ddb.send(
    new UpdateCommand({
      TableName: env.paymentRecordsTable,
      Key: { paymentId },
      UpdateExpression: "SET confirmationEmailSentAt = :sentAt",
      ExpressionAttributeValues: { ":sentAt": sentAt },
    }),
  );
  await billingAuditService.logBillingAction("payment_confirmation_email_sent", "payment", paymentId, "system", {
    agencyId: payment.agencyId,
    customerId: payment.customerId,
    invoiceId: payment.invoiceId,
    toEmail: customer.email,
  });
  return { sent: true, sentAt };
}

export async function sendReminderEmail(
  invoiceId: string,
  reminderType: ReminderType,
): Promise<{ sent: true; sentAt: string }> {
  const sender = requireSenderEmail();
  const invoiceOut = await ddb.send(new GetCommand({ TableName: env.invoicesTable, Key: { invoiceId } }));
  const invoice = invoiceOut.Item as
    | {
        invoiceId: string;
        agencyId?: string;
        customerId?: string;
        invoiceNumber?: string;
        dueDate?: string;
        total?: number;
        amountPaid?: number;
        currency?: string;
        pdfS3Key?: string;
      }
    | undefined;
  if (!invoice?.invoiceId || !invoice.customerId) throw new Error("Invoice not found");

  const customerOut = await ddb.send(
    new GetCommand({ TableName: env.customersTable, Key: { customerId: invoice.customerId } }),
  );
  const customer = customerOut.Item as { email?: string; agencyName?: string; billingContact?: string } | undefined;
  if (!customer?.email) throw new Error("Customer email not found");

  const balanceDue = Number(Math.max(0, Number(invoice.total ?? 0) - Number(invoice.amountPaid ?? 0)).toFixed(2));
  const label = {
    "3_DAYS_BEFORE": "due in 3 days",
    DUE_TODAY: "due today",
    "7_DAYS_OVERDUE": "7 days overdue",
    "15_DAYS_OVERDUE": "15 days overdue",
    "30_DAYS_OVERDUE": "30 days overdue",
  }[reminderType];
  const pdfUrl = await signedInvoicePdfUrl(invoice.pdfS3Key);
  const paymentInfo = await loadPaymentInstructions();

  const html = brandedHtml(`
    <h2 style="margin:0 0 10px 0;">Invoice Reminder</h2>
    <p style="margin:0 0 16px 0;">Hello ${customer.billingContact ?? customer.agencyName ?? "Customer"}, invoice <b>${invoice.invoiceNumber ?? invoiceId}</b> is ${label}.</p>
    <table cellpadding="6" cellspacing="0" style="font-size:14px;border-collapse:collapse;">
      <tr><td><b>Due Date</b></td><td>${invoice.dueDate ?? "-"}</td></tr>
      <tr><td><b>Balance Due</b></td><td><b>${money(balanceDue, invoice.currency ?? "USD")}</b></td></tr>
    </table>
    ${paymentInstructionsHtml(paymentInfo)}
    ${
      pdfUrl
        ? `<p style="margin:0;"><a href="${pdfUrl}" style="display:inline-block;background:#0f2f64;color:#fff;text-decoration:none;padding:10px 14px;border-radius:6px;">Download Invoice PDF</a></p>`
        : ""
    }
  `);

  await ses.send(
    new SendEmailCommand({
      Source: sender,
      Destination: { ToAddresses: [customer.email] },
      Message: {
        Subject: { Data: `Reminder: Invoice ${invoice.invoiceNumber ?? invoiceId} ${label}` },
        Body: { Html: { Data: html } },
      },
    }),
  );

  const sentAt = new Date().toISOString();
  await ddb.send(
    new UpdateCommand({
      TableName: env.invoicesTable,
      Key: { invoiceId },
      UpdateExpression:
        "SET lastReminderType = :reminderType, lastReminderSentAt = :sentAt, reminderEmailCount = if_not_exists(reminderEmailCount, :zero) + :one, updatedAt = :sentAt",
      ExpressionAttributeValues: {
        ":reminderType": reminderType,
        ":sentAt": sentAt,
        ":zero": 0,
        ":one": 1,
      },
    }),
  );
  await billingAuditService.logBillingAction("invoice_reminder_email_sent", "invoice", invoiceId, "system", {
    agencyId: invoice.agencyId,
    customerId: invoice.customerId,
    invoiceId,
    reminderType,
    toEmail: customer.email,
    balanceDue,
  });
  return { sent: true, sentAt };
}

export async function handleSesFeedbackNotification(payload: {
  notificationType?: "Bounce" | "Complaint";
  mail?: { destination?: string[] };
  bounce?: { bouncedRecipients?: Array<{ emailAddress?: string }> };
  complaint?: { complainedRecipients?: Array<{ emailAddress?: string }> };
  messageId?: string;
  timestamp?: string;
}): Promise<void> {
  const type = payload.notificationType;
  if (type !== "Bounce" && type !== "Complaint") return;

  const recipients =
    type === "Bounce"
      ? (payload.bounce?.bouncedRecipients ?? []).map((r) => r.emailAddress).filter(Boolean)
      : (payload.complaint?.complainedRecipients ?? []).map((r) => r.emailAddress).filter(Boolean);

  await billingAuditService.logBillingAction(
    type === "Bounce" ? "ses_bounce" : "ses_complaint",
    "email",
    payload.messageId ?? "unknown",
    "system",
    {
      recipients,
      destination: payload.mail?.destination ?? [],
      timestamp: payload.timestamp ?? new Date().toISOString(),
      notificationType: type,
    },
  );
}
