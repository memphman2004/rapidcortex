/**
 * SES sender for automated invoices. Invoked by the generator (optional auto-send)
 * and the HTTP resend route. HTML/text come from the shared email builder.
 */

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import {
  buildInvoiceEmailHtml,
  buildInvoiceEmailSubject,
  buildInvoiceEmailText,
  type AutomatedInvoice,
} from "rapid-cortex-shared";
import { env } from "../../lib/env.js";

const ses = new SESClient({ region: env.region });

export async function sendAutomatedInvoiceEmail(invoice: AutomatedInvoice): Promise<{ sent: boolean; skipped?: string }> {
  if (process.env.SES_MOCK === "1" || process.env.SMS_MOCK === "1") {
    console.log(
      JSON.stringify({
        level: "INFO",
        event: "AUTOMATED_INVOICE_EMAIL_MOCK",
        invoiceId: invoice.invoiceId,
        to: invoice.billingContactEmail,
      }),
    );
    return { sent: false, skipped: "ses_mock" };
  }

  const from = env.billingSesSenderEmail || process.env.FROM_EMAIL || "billing@rapidcortex.us";
  const to = invoice.billingContactEmail.trim();
  if (!to) return { sent: false, skipped: "missing_recipient" };

  const configSet = env.sesConfigurationSetName;
  await ses.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: buildInvoiceEmailSubject(invoice), Charset: "UTF-8" },
        Body: {
          Html: { Data: buildInvoiceEmailHtml(invoice), Charset: "UTF-8" },
          Text: { Data: buildInvoiceEmailText(invoice), Charset: "UTF-8" },
        },
      },
      ...(configSet ? { ConfigurationSetName: configSet } : {}),
    }),
  );
  return { sent: true };
}
