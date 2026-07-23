/**
 * Marketing Lead Capture — Inside the Cortex
 * Route: POST /api/marketing/lead (public, Authorizer NONE)
 */

import { createHash, randomUUID } from "node:crypto";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { marketingLeadBodySchema, resolveMarketingLeadSource } from "rapid-cortex-shared";
import { ddb } from "../repositories/baseRepository.js";
import { env } from "../lib/env.js";
import { parseDeviceType } from "../features/leads/leads-normalize.js";
import { SalesLeadRepository } from "../repositories/salesLeadRepository.js";

const ses = new SESClient({});

const CORS = {
  "Access-Control-Allow-Origin": "https://www.rapidcortex.us",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function json(body: object, statusCode = 200) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (event.requestContext.http.method === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }
  if (event.requestContext.http.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!env.enableInsideTheCortex) {
    return json({ error: "Feature is not available" }, 503);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(event.body ?? "{}");
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const parsed = marketingLeadBodySchema.safeParse(parsedJson);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid request";
    return json({ error: msg }, 400);
  }

  const body = parsed.data;
  const emailLower = body.email.trim().toLowerCase();
  const table = env.marketingLeadsTable;
  if (!table) {
    console.error(JSON.stringify({ msg: "marketing_lead_error", error: "MARKETING_LEADS_TABLE not set" }));
    return json({ error: "Service unavailable" }, 500);
  }

  try {
    const existing = await ddb.send(
      new GetCommand({
        TableName: table,
        Key: { pk: `LEAD#${emailLower}`, sk: "PROFILE" },
      }),
    );
    if (existing.Item) return json({ success: true, duplicate: true });
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "marketing_lead_dedup_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  const leadId = randomUUID();
  const unsubscribeToken = randomUUID();
  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + 365 * 3 * 86400;
  const referrer = body.referrer ?? null;
  const landingPage = body.landingPage ?? "/";
  const source = resolveMarketingLeadSource(referrer);
  const firstName = body.firstName.trim();
  const lastName = body.lastName.trim();
  const state = body.state.trim();

  try {
    await ddb.send(
      new PutCommand({
        TableName: table,
        Item: {
          pk: `LEAD#${emailLower}`,
          sk: "PROFILE",
          leadId,
          unsubscribeToken,
          firstName,
          lastName,
          email: emailLower,
          state,
          source,
          referrer,
          landingPage,
          capturedAt: body.capturedAt ?? now,
          createdAt: now,
          status: "active",
          ttl,
        },
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );

    await ddb.send(
      new PutCommand({
        TableName: table,
        Item: {
          pk: `TOKEN#${unsubscribeToken}`,
          sk: "UNSUBSCRIBE",
          email: emailLower,
          leadId,
          ttl,
        },
      }),
    );
  } catch (err: unknown) {
    if ((err as { name?: string }).name === "ConditionalCheckFailedException") {
      return json({ success: true, duplicate: true });
    }
    console.error(
      JSON.stringify({
        msg: "marketing_lead_write_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return json({ error: "Failed to capture lead" }, 500);
  }

  // [CR-5] Dual-write into SalesLeads CRM (non-fatal; MarketingLeads remains SoT for unsubscribe).
  try {
    const salesRepo = new SalesLeadRepository();
    const headers = event.headers ?? {};
    const ua = headers["user-agent"] ?? headers["User-Agent"] ?? "";
    let referrerDomain: string | null = null;
    if (referrer) {
      try {
        referrerDomain = new URL(referrer).hostname;
      } catch {
        referrerDomain = null;
      }
    }
    const cortexLeadId = `cortex-${createHash("sha256").update(emailLower).digest("hex").slice(0, 24)}`;
    await salesRepo.putCortexLeadIfAbsent({
      leadId: cortexLeadId,
      email: emailLower,
      firstName,
      lastName,
      state,
      source: "inside_the_cortex",
      status: "new",
      pipelineStage: "NEW",
      packageSold: "none",
      notes: [],
      activities: [
        {
          activityId: randomUUID(),
          type: "created",
          description: "Lead created · Source: Inside the Cortex",
          createdAt: now,
        },
      ],
      attribution: {
        channel: "inside_the_cortex",
        channelLabel: "Inside the Cortex",
        landingPage: landingPage ?? null,
        referrerUrl: referrer,
        referrerDomain,
        utmSource: body.utmSource ?? null,
        utmMedium: body.utmMedium ?? null,
        utmCampaign: body.utmCampaign ?? null,
        utmContent: body.utmContent ?? null,
        deviceType: parseDeviceType(ua),
        ipRegion: headers["cloudfront-viewer-state"] ?? headers["CloudFront-Viewer-State"] ?? null,
        ipCity: headers["cloudfront-viewer-city"] ?? headers["CloudFront-Viewer-City"] ?? null,
        ipCountry: headers["cloudfront-viewer-country"] ?? headers["CloudFront-Viewer-Country"] ?? "US",
        firstTouchAt: now,
      },
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "cortex_lead_sales_write_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  const siteUrl = "https://www.rapidcortex.us";
  const unsubUrl = `${siteUrl}/unsubscribe?token=${unsubscribeToken}`;
  const sesFrom = env.sesFromEmail || env.contactFromEmail || "noreply@rapidcortex.us";
  const teamEmail = env.rcTeamNotifyEmail || "team@rapidcortex.us";

  if (!env.sesMock && sesFrom) {
    try {
      await ses.send(
        new SendEmailCommand({
          Source: `Rapid Cortex <${sesFrom}>`,
          Destination: { ToAddresses: [`${firstName} ${lastName} <${emailLower}>`] },
          Message: {
            Subject: { Data: `You're inside the Cortex, ${firstName}.` },
            Body: {
              Text: {
                Data: [
                  `Hey ${firstName},`,
                  "",
                  "Signal acquired. You're inside the Cortex.",
                  "",
                  "Rapid Cortex exists for one reason: the people running toward the emergency",
"dispatchers, supervisors, first responders, the whole chain deserves technology",
"that moves at their speed. Not enterprise software wearing a vest. Not AI that",
"doesn't understand what's at stake. The actual thing, built for the actual work.",
"",
"Inside the Cortex is our open channel. You'll get the real version of what's",
"happening — what we're building, what we're learning in the field, and where",
"public safety technology is actually headed. We won't flood your inbox.",
"When we have something worth your attention, you'll hear it.",
"",
"Welcome to the frequency. We're glad you're receiving us.",
"",
"— The Rapid Cortex Team",
"Intelligence at the speed of response.",
siteUrl,
"",
"---",
"You're on this frequency because you signed up at rapidcortex.us.",
`Go dark anytime: ${unsubUrl}`,
                ].join("\n"),
              },
              Html: { Data: buildWelcomeEmail({ firstName, siteUrl, unsubUrl }) },
            },
          },
        }),
      );
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "marketing_welcome_email_error",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }

    try {
      await ses.send(
        new SendEmailCommand({
          Source: `Rapid Cortex <${sesFrom}>`,
          Destination: { ToAddresses: [teamEmail] },
          Message: {
            Subject: { Data: `New Cortex signup — ${firstName} ${lastName} (${state})` },
            Body: {
              Text: {
                Data: [
                  "New Inside the Cortex signup",
                  "",
                  `Name:     ${firstName} ${lastName}`,
                  `Email:    ${emailLower}`,
                  `State:    ${state}`,
                  `Source:   ${source}`,
                  `Referrer: ${referrer ?? "direct"}`,
                  `Page:     ${landingPage}`,
                  `Time:     ${now}`,
                  `Lead ID:  ${leadId}`,
                ].join("\n"),
              },
            },
          },
        }),
      );
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "marketing_team_notify_error",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  } else if (env.sesMock) {
    console.info(JSON.stringify({ msg: "marketing_ses_mock", leadId, email: emailLower }));
  }

  return json({ success: true, leadId });
};

function buildWelcomeEmail({
  firstName,
  siteUrl,
  unsubUrl,
}: {
  firstName: string;
  siteUrl: string;
  unsubUrl: string;
}): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const name = esc(firstName);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>You're inside the Cortex</title></head>
<body style="margin:0;padding:24px 16px;background:#0a0f1e;font-family:system-ui,-apple-system,sans-serif;">
<div style="max-width:520px;margin:0 auto;">

  <div style="background:#060c1a;border-radius:8px 8px 0 0;padding:20px 28px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #1b2b47;">
    <span style="font-size:11px;font-weight:600;color:#93c5fd;letter-spacing:0.12em;">RAPID CORTEX</span>
    <span style="font-size:10px;color:#334466;letter-spacing:0.05em;">Intelligence at the speed of response.</span>
  </div>

  <div style="background:#0c1428;border-left:1px solid #1b2b47;border-right:1px solid #1b2b47;padding:32px 28px 28px;">
    <div style="display:inline-block;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.25);border-radius:20px;padding:4px 14px;margin-bottom:22px;">
      <span style="font-size:10px;font-weight:600;color:#93c5fd;letter-spacing:0.08em;">&#9679;&nbsp; INSIDE THE CORTEX</span>
    </div>
    <p style="font-size:20px;font-weight:500;color:#dce6f5;margin:0 0 6px;line-height:1.3;">You're inside, ${name}.</p>
    <p style="font-size:13px;color:#6b83a8;margin:0 0 28px;">Welcome to the response.</p>
    <div style="border-top:1px solid #1b2b47;padding-top:24px;">
      <p style="font-size:14px;color:#a8bdd6;line-height:1.75;margin:0 0 18px;">Hey ${name}, thank you &mdash; genuinely &mdash; for signing up.</p>
      <p style="font-size:14px;color:#a8bdd6;line-height:1.75;margin:0 0 18px;">We started Rapid Cortex because we believe the people who protect communities deserve technology that&apos;s actually built for them. Not retrofitted from enterprise software. Not watered down. Purpose-built for the speed and stakes of emergency response.</p>
      <p style="font-size:14px;color:#a8bdd6;line-height:1.75;margin:0 0 18px;">Every signup like yours tells us this work matters. <strong style="color:#dce6f5;font-weight:500;">Inside the Cortex</strong> is how we stay connected &mdash; real updates, real progress, honest insight from the people building the platform. You&apos;ll hear from us when we have something worth saying.</p>
      <p style="font-size:14px;color:#dce6f5;line-height:1.75;margin:0 0 28px;font-weight:500;">Thank you for being here. We won&apos;t let you down.</p>
      <div style="background:#0f1e38;border:1px solid #1b2b47;border-radius:8px;padding:16px 20px;">
        <p style="font-size:12px;color:#6b83a8;margin:0 0 4px;">FROM</p>
        <p style="font-size:14px;color:#dce6f5;margin:0 0 4px;font-weight:500;">The Rapid Cortex Team</p>
        <a href="${siteUrl}" style="font-size:12px;color:#3b82f6;text-decoration:none;">${siteUrl}</a>
      </div>
    </div>
  </div>

  <div style="background:#07101e;border:1px solid #1b2b47;border-top:none;border-radius:0 0 8px 8px;padding:14px 28px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
    <span style="font-size:10px;color:#334466;">You received this because you signed up at rapidcortex.us</span>
    <a href="${unsubUrl}" style="font-size:10px;color:#6b83a8;text-decoration:underline;">Unsubscribe</a>
  </div>

</div>
</body>
</html>`;
}
