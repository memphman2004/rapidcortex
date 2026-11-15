/**
 * Pricing Quote Request — NexCort iQ
 * Route: POST /api/quote-request  (public, Authorizer NONE)
 *
 * Flow:
 *   1. Zod-parse body with quoteRequestBodySchema from rapid-cortex-shared
 *   2. Write to SalesLeadsTable via SalesLeadRepository (source: "pricing_quote")
 *   3. SES: notify team + send confirmation to submitter (non-fatal)
 *   4. Apollo.io: create/upsert people contact (non-fatal)
 *
 * Production hookup point: Apollo contact creation at the bottom uses
 *   RAPID_IQ_APOLLO_API_KEY / RAPID_IQ_APOLLO_API_KEY_SECRET_ARN env vars.
 *   Set via stack-app-sam-3.yaml PostQuoteRequestFunction env block.
 */

import { randomUUID } from "node:crypto";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import {
  QUOTE_REQUEST_AGENCY_TYPE_LABELS,
  QUOTE_REQUEST_POPULATION_LABELS,
  QUOTE_REQUEST_POSITION_LABELS,
  QUOTE_REQUEST_PRODUCT_LABELS,
  QUOTE_REQUEST_TIMELINE_LABELS,
  quoteRequestBodySchema,
  type ContactSalesLeadBody,
  type QuoteRequestBody,
} from "rapid-cortex-shared";
import { SalesLeadRepository } from "../repositories/salesLeadRepository.js";
import { env } from "../lib/env.js";
import { sesConfigurationSetFields } from "../lib/ses/sesConfigurationSet.js";
import { resolvePlainOrSecretArn } from "../lib/runtimeSecrets.js";

const repo = new SalesLeadRepository();
const ses = new SESClient({});
const sns = new SNSClient({});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
} as const;

function json(body: object, statusCode = 200) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function labelOrRaw(map: Record<string, string>, key: string): string {
  return map[key] ?? key;
}

function formatInternalBody(body: QuoteRequestBody, leadId: string, now: string): string {
  const productLines =
    body.products.length > 0
      ? body.products
          .map((p) => `  • ${labelOrRaw(QUOTE_REQUEST_PRODUCT_LABELS as Record<string, string>, p)}`)
          .join("\n")
      : "  (none selected)";

  return [
    `Quote Request — NexCort iQ Pricing Page`,
    `Lead ID: ${leadId}`,
    `Submitted: ${now}`,
    "",
    `Name:         ${body.name}`,
    `Agency:       ${body.agencyName}`,
    `Email:        ${body.email}`,
    `Phone:        ${body.phone?.trim() || "(not provided)"}`,
    "",
    `Agency type:  ${labelOrRaw(QUOTE_REQUEST_AGENCY_TYPE_LABELS as Record<string, string>, body.agencyType)}`,
    `Population:   ${labelOrRaw(QUOTE_REQUEST_POPULATION_LABELS as Record<string, string>, body.population)}`,
    `Positions:    ${labelOrRaw(QUOTE_REQUEST_POSITION_LABELS as Record<string, string>, body.positions)}`,
    `CAD system:   ${body.cadSystem?.trim() || "(not provided)"}`,
    `Timeline:     ${labelOrRaw(QUOTE_REQUEST_TIMELINE_LABELS as Record<string, string>, body.timeline)}`,
    `Funding:      ${body.funding?.trim() || "(not provided)"}`,
    "",
    "Products of interest:",
    productLines,
    "",
    "Additional notes:",
    body.notes?.trim() || "(none)",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// SES helpers (non-fatal)
// ---------------------------------------------------------------------------

async function notifyTeam(body: QuoteRequestBody, leadId: string, now: string): Promise<void> {
  const from = env.contactFromEmail?.trim();
  if (!from) return;

  const teamEmail = env.rcTeamNotifyEmail || "team@nexcortiq.us";
  const subject = `New Quote Request — ${body.name} at ${body.agencyName}`;

  await ses.send(
    new SendEmailCommand({
      ...sesConfigurationSetFields(),
      Source: `NexCort iQ <${from}>`,
      Destination: { ToAddresses: [teamEmail] },
      Message: {
        Subject: { Charset: "UTF-8", Data: subject },
        Body: { Text: { Charset: "UTF-8", Data: formatInternalBody(body, leadId, now) } },
      },
    }),
  );
}

async function confirmToSubmitter(body: QuoteRequestBody): Promise<void> {
  const from = env.contactFromEmail?.trim();
  if (!from) return;

  const firstName = body.name.split(" ")[0] ?? body.name;
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  await ses.send(
    new SendEmailCommand({
      ...sesConfigurationSetFields(),
      Source: `NexCort iQ <${from}>`,
      Destination: { ToAddresses: [`${body.name} <${body.email}>`] },
      Message: {
        Subject: { Charset: "UTF-8", Data: `Your NexCort iQ quote request is in, ${firstName}` },
        Body: {
          Text: {
            Charset: "UTF-8",
            Data: [
              `Hi ${firstName},`,
              "",
              "We received your quote request. Our team will review your agency profile and send a tailored quote within one business day.",
              "",
              "For urgent inquiries, reply to this email or call us at (800) 555-0199.",
              "",
              "— The NexCort iQ Team",
              "Intelligence at the speed of response.",
              "https://www.nexcortiq.us",
            ].join("\n"),
          },
          Html: {
            Charset: "UTF-8",
            Data: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:24px 16px;background:#0a0f1e;font-family:system-ui,-apple-system,sans-serif;">
<div style="max-width:520px;margin:0 auto;background:#0c1428;border:1px solid #1b2b47;border-radius:8px;padding:32px 28px;">
  <p style="font-size:11px;font-weight:600;color:#93c5fd;letter-spacing:0.12em;margin:0 0 24px;">NEXCORT IQ</p>
  <p style="font-size:20px;font-weight:500;color:#dce6f5;margin:0 0 12px;">Quote request received, ${esc(firstName)}.</p>
  <p style="font-size:14px;color:#a8bdd6;line-height:1.75;margin:0 0 16px;">
    Our team will review your agency profile and send a tailored quote within <strong style="color:#dce6f5;">one business day</strong>.
  </p>
  <p style="font-size:14px;color:#a8bdd6;line-height:1.75;margin:0 0 24px;">
    For urgent requests, reply to this email or reach us directly at <strong style="color:#dce6f5;">(800) 555-0199</strong>.
  </p>
  <p style="font-size:12px;color:#6b83a8;margin:0;">— The NexCort iQ Team</p>
</div>
</body></html>`,
          },
        },
      },
    }),
  );
}

async function publishSns(body: QuoteRequestBody, leadId: string): Promise<void> {
  const topicArn = env.opsSnsTopicArn?.trim();
  if (!topicArn) return;
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Subject: "New NexCort iQ Quote Request",
      Message: `Quote request: ${body.name} at ${body.agencyName} — ${body.email} — lead ${leadId}`,
    }),
  );
}

// ---------------------------------------------------------------------------
// Apollo contact create (non-fatal)
// apollo_contacts_create: POST /api/v1/contacts
// Payload maps directly: first_name, last_name, email, phone_numbers,
//   organization_name, label_names (agency type + products)
// ---------------------------------------------------------------------------

async function createApolloContact(body: QuoteRequestBody, leadId: string): Promise<void> {
  const apiKey = await resolvePlainOrSecretArn(
    process.env.RAPID_IQ_APOLLO_API_KEY,
    process.env.RAPID_IQ_APOLLO_API_KEY_SECRET_ARN,
    { preferredField: "apiKey" },
  );
  if (!apiKey) {
    console.info(JSON.stringify({ msg: "quote_request_apollo_skipped_no_key", leadId }));
    return;
  }

  const nameParts = body.name.trim().split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ") || "";

  const labelNames = [
    "nexcortiq-quote-request",
    body.agencyType,
    ...body.products.slice(0, 5),
  ];

  const payload = {
    first_name: firstName,
    last_name: lastName,
    email: body.email,
    organization_name: body.agencyName,
    ...(body.phone?.trim() ? { phone_numbers: [{ raw_number: body.phone.trim() }] } : {}),
    label_names: labelNames,
    // Store key quote fields in a note via the note field or custom fields (Apollo People v1 supports note)
    present_raw_address: undefined as string | undefined,
  };

  const res = await fetch("https://api.apollo.io/api/v1/contacts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn(
      JSON.stringify({
        msg: "quote_request_apollo_contact_failed",
        status: res.status,
        body: text.slice(0, 300),
        leadId,
      }),
    );
    return;
  }

  const json = (await res.json()) as { contact?: { id?: string } };
  const apolloContactId = json.contact?.id?.trim() || "";
  console.info(
    JSON.stringify({ msg: "quote_request_apollo_contact_created", apolloContactId, leadId }),
  );
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (event.requestContext.http.method === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }
  if (event.requestContext.http.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!env.salesLeadsTable) {
    return json({ error: "Service unavailable (SALES_LEADS_TABLE)" }, 503);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(event.body ?? "{}");
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const parsed = quoteRequestBodySchema.safeParse(parsedJson);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid request";
    return json({ error: msg, issues: parsed.error.issues }, 400);
  }

  const body = parsed.data;
  const now = new Date().toISOString();
  const leadId = randomUUID();

  // Map quote fields onto the SalesLeadRecord shape
  const lead = {
    leadId,
    createdAt: now,
    updatedAt: now,
    name: body.name,
    email: body.email,
    phone: body.phone ?? "",
    agencyCompany: body.agencyName,
    agencyName: body.agencyName,
    customerType: body.agencyType,
    // body.products is string[] from Zod inference, but its values come from QUOTE_REQUEST_PRODUCTS
    // which are a subset of the expanded interestedIn enum. Cast required due to Zod inference width.
    interestedIn: body.products as unknown as ContactSalesLeadBody["interestedIn"],
    message: [
      `Agency type: ${labelOrRaw(QUOTE_REQUEST_AGENCY_TYPE_LABELS as Record<string, string>, body.agencyType)}`,
      `Population: ${labelOrRaw(QUOTE_REQUEST_POPULATION_LABELS as Record<string, string>, body.population)}`,
      `Positions: ${labelOrRaw(QUOTE_REQUEST_POSITION_LABELS as Record<string, string>, body.positions)}`,
      body.cadSystem ? `CAD system: ${body.cadSystem}` : null,
      `Timeline: ${labelOrRaw(QUOTE_REQUEST_TIMELINE_LABELS as Record<string, string>, body.timeline)}`,
      body.funding ? `Funding: ${body.funding}` : null,
      body.notes ? `Notes: ${body.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    estimatedAgencySize: labelOrRaw(
      QUOTE_REQUEST_POSITION_LABELS as Record<string, string>,
      body.positions,
    ),
    source: "pricing_quote",
    formSource: "pricing_quote_request" as const,
    status: "new" as const,
    pipelineStage: "NEW" as const,
    attribution: {
      channel: "pricing_page" as const,
      channelLabel: "Pricing page quote estimator",
      landingPage: "/pricing#estimator",
      firstTouchAt: now,
    },
  };

  try {
    await repo.putLead(lead);
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "quote_request_write_error",
        error: err instanceof Error ? err.message : String(err),
        leadId,
      }),
    );
    return json({ error: "Failed to record quote request" }, 500);
  }

  // Non-fatal notifications
  try {
    await notifyTeam(body, leadId, now);
  } catch (err) {
    console.error(JSON.stringify({ msg: "quote_request_ses_team_error", leadId, error: String(err) }));
  }
  try {
    await confirmToSubmitter(body);
  } catch (err) {
    console.error(JSON.stringify({ msg: "quote_request_ses_confirm_error", leadId, error: String(err) }));
  }
  try {
    await publishSns(body, leadId);
  } catch (err) {
    console.error(JSON.stringify({ msg: "quote_request_sns_error", leadId, error: String(err) }));
  }

  // Apollo contact create — POST /api/quote-request → Lambda → CRM integration point
  try {
    await createApolloContact(body, leadId);
  } catch (err) {
    console.error(JSON.stringify({ msg: "quote_request_apollo_error", leadId, error: String(err) }));
  }

  return json({ ok: true, leadId }, 202);
};
