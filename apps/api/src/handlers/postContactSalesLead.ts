import { randomUUID } from "node:crypto";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { contactSalesLeadBodySchema } from "rapid-cortex-shared";
import { badRequestFromZod } from "../lib/response.js";
import { SalesLeadRepository, type SalesLeadRecord } from "../repositories/salesLeadRepository.js";
import { env } from "../lib/env.js";
import { sesConfigurationSetFields } from "../lib/ses/sesConfigurationSet.js";

const repo = new SalesLeadRepository();
const sns = new SNSClient({});
const ses = new SESClient({});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

/** In-app sales notifications — must match a verified SES identity (and IAM `ses:SendEmail` resource). */
const CONTACT_SALES_INTERNAL_TO = "support@nexcortiq.us";

/**
 * Sends internal + confirmation mail via SES when `CONTACT_FROM_EMAIL` is set.
 *
 * SES sandbox: both the From identity and every destination address must be verified in SES until the account
 * leaves the sandbox (production access). Otherwise SendEmail fails with MessageRejected.
 */
function formatInternalSalesEmailBody(lead: SalesLeadRecord): string {
  const smsOptedIn = lead.smsConsentOptedIn === true;
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
    "Business Communications SMS consent:",
    `  Opted in: ${smsOptedIn ? "yes" : "no"}`,
    `  Consent at: ${smsOptedIn && lead.smsConsentAt ? lead.smsConsentAt : "(n/a)"}`,
    `  Disclosure version: ${lead.smsConsentDisclosureVersion?.trim() || "(n/a)"}`,
    `  Form source: ${lead.formSource?.trim() || lead.source || "(n/a)"}`,
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
      Subject: "New NexCort iQ Sales Lead",
      Message: `New sales lead: ${lead.name} from ${lead.agencyCompany} - ${lead.email} - ${phone}`,
    }),
  );
}

async function sendSalesLeadEmails(lead: SalesLeadRecord): Promise<void> {
  const from = env.contactFromEmail.trim();
  if (!from) return;

  await ses.send(
    new SendEmailCommand({
      ...sesConfigurationSetFields(),
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
      ...sesConfigurationSetFields(),
      Source: from,
      Destination: { ToAddresses: [lead.email] },
      Message: {
        Subject: { Charset: "UTF-8", Data: "Thanks for contacting NexCort iQ" },
        Body: {
          Text: {
            Charset: "UTF-8",
            Data: [
              `Hi ${lead.name},`,
              "",
              "Thank you for reaching out to NexCort iQ. We received your request and will follow up within one business day.",
              "",
              "If your matter is urgent, please reply to this email and reference the details you already shared.",
              "",
              "Best regards,",
              "NexCort iQ",
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

  const now = new Date().toISOString();
  const isDemoRequest =
    rest.formSource === "demo" ||
    (rest.message ?? "").includes("Source: /demo") ||
    (rest.message ?? "").includes("interest=demo");
  const isSmsConsentPage =
    rest.formSource === "sms-consent" ||
    (rest.message ?? "").includes("Source: /sms-consent");
  const formSource =
    rest.formSource ?? (isSmsConsentPage ? "sms-consent" : isDemoRequest ? "demo" : "contact-sales");
  const smsConsentOptedIn = rest.smsConsentOptedIn === true;
  const source =
    formSource === "sms-consent" ? "sms-consent" : isDemoRequest ? "demo" : "contact-sales";
  const channelLabel =
    formSource === "sms-consent"
      ? "SMS consent opt-in form"
      : isDemoRequest
        ? "Live demo request"
        : "Contact Sales";
  const landingPage =
    formSource === "sms-consent"
      ? "/sms-consent/#opt-in-form"
      : isDemoRequest
        ? (rest.message ?? "").includes("interest=demo")
          ? "/contact-sales?interest=demo"
          : "/demo"
        : "/contact-sales";
  const lead: SalesLeadRecord = {
    ...rest,
    formSource,
    smsConsentOptedIn,
    smsConsentDisclosureVersion: smsConsentOptedIn
      ? rest.smsConsentDisclosureVersion
      : rest.smsConsentDisclosureVersion ?? undefined,
    smsConsentAt: smsConsentOptedIn ? now : null,
    smsConsentStatus: smsConsentOptedIn ? "opted_in" : "pending",
    leadId: randomUUID(),
    createdAt: now,
    source,
    status: "new",
    pipelineStage: "NEW",
    attribution: {
      channel: "contact_sales",
      channelLabel,
      landingPage,
      firstTouchAt: now,
    },
  };
  await repo.putLead(lead);

  await notifyAfterLeadSaved(lead);

  return {
    statusCode: 202,
    headers: { "Content-Type": "application/json", ...cors },
    body: JSON.stringify({ ok: true, leadId: lead.leadId }),
  };
};
