import { randomUUID } from "node:crypto";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { contactSalesLeadBodySchema } from "rapid-cortex-shared";
import { badRequestFromZod } from "../lib/response.js";
import { SalesLeadRepository, type SalesLeadRecord } from "../repositories/salesLeadRepository.js";
import { env } from "../lib/env.js";

const repo = new SalesLeadRepository();
const sns = new SNSClient({});
const ses = new SESClient({});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

/** In-app sales notifications — must match a verified SES identity (and IAM `ses:SendEmail` resource). */
const CONTACT_SALES_INTERNAL_TO = "support@rapidcortex.us";

/**
 * Sends internal + confirmation mail via SES when `CONTACT_FROM_EMAIL` is set.
 *
 * SES sandbox: both the From identity and every destination address must be verified in SES until the account
 * leaves the sandbox (production access). Otherwise SendEmail fails with MessageRejected.
 */
function formatInternalSalesEmailBody(lead: SalesLeadRecord): string {
  const lines = [
    `Lead ID: ${lead.leadId}`,
    `Submitted: ${lead.createdAt}`,
    "",
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone?.trim() ? lead.phone : "(not provided)"}`,
    `Company: ${lead.agencyCompany}`,
    `Role: ${lead.role?.trim() ? lead.role : "(not provided)"}`,
    `Agency / customer type: ${lead.customerType}`,
    `Interested in: ${lead.interestedIn.join(", ")}`,
    `Estimated agency size / dispatchers: ${lead.estimatedAgencySize?.trim() ? lead.estimatedAgencySize : "(not provided)"}`,
    "",
    "Message:",
    lead.message?.trim() ? lead.message : "(none)",
  ];
  return lines.join("\n");
}

async function publishSalesLeadSns(lead: SalesLeadRecord): Promise<void> {
  const topicArn = env.opsSnsTopicArn.trim();
  if (!topicArn) return;
  const phone = lead.phone?.trim() ? lead.phone : "no phone";
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Subject: "New Rapid Cortex Sales Lead",
      Message: `New sales lead: ${lead.name} from ${lead.agencyCompany} - ${lead.email} - ${phone}`,
    }),
  );
}

async function sendSalesLeadEmails(lead: SalesLeadRecord): Promise<void> {
  const from = env.contactFromEmail.trim();
  if (!from) return;

  await ses.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [CONTACT_SALES_INTERNAL_TO] },
      Message: {
        Subject: {
          Charset: "UTF-8",
          Data: `New Sales Lead: ${lead.name} from ${lead.agencyCompany}`,
        },
        Body: {
          Text: {
            Charset: "UTF-8",
            Data: formatInternalSalesEmailBody(lead),
          },
        },
      },
    }),
  );

  await ses.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [lead.email] },
      Message: {
        Subject: { Charset: "UTF-8", Data: "Thanks for contacting Rapid Cortex" },
        Body: {
          Text: {
            Charset: "UTF-8",
            Data: [
              `Hi ${lead.name},`,
              "",
              "Thank you for reaching out to Rapid Cortex. We received your request and will follow up within one business day.",
              "",
              "If your matter is urgent, please reply to this email and reference the details you already shared.",
              "",
              "Best regards,",
              "Rapid Cortex",
            ].join("\n"),
          },
        },
      },
    }),
  );
}

async function notifyAfterLeadSaved(lead: SalesLeadRecord): Promise<void> {
  try {
    await publishSalesLeadSns(lead);
  } catch (err) {
    console.error("postContactSalesLead: SNS publish failed", err);
  }

  try {
    await sendSalesLeadEmails(lead);
  } catch (err) {
    console.error("postContactSalesLead: SES send failed", err);
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (event.requestContext.http.method === "OPTIONS") {
    return { statusCode: 204, headers: cors };
  }

  if (!env.salesLeadsTable) {
    return {
      statusCode: 503,
      headers: cors,
      body: JSON.stringify({ error: "Lead capture not configured (SALES_LEADS_TABLE)." }),
    };
  }

  const bodyRaw =
    event.isBase64Encoded && event.body
      ? Buffer.from(event.body, "base64").toString("utf8")
      : (event.body ?? "{}");

  const parsed = contactSalesLeadBodySchema.safeParse(JSON.parse(bodyRaw));
  if (!parsed.success) return badRequestFromZod(parsed.error);

  const { website, ...rest } = parsed.data;
  if (website?.trim()) {
    return {
      statusCode: 202,
      headers: { "Content-Type": "application/json", ...cors },
      body: JSON.stringify({ ok: true }),
    };
  }

  const lead: SalesLeadRecord = {
    ...rest,
    leadId: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await repo.putLead(lead);

  await notifyAfterLeadSaved(lead);

  return {
    statusCode: 202,
    headers: { "Content-Type": "application/json", ...cors },
    body: JSON.stringify({ ok: true, leadId: lead.leadId }),
  };
};
