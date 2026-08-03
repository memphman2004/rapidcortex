/**
 * Public careers apply — POST /api/careers/apply (Authorizer NONE).
 */
import { randomUUID } from "node:crypto";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  careersApplyBodySchema,
  positionDisplayName,
  type JobApplication,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../../lib/env.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { makeId } from "../../lib/ids.js";
import { sesConfigurationSetFields } from "../../lib/ses/sesConfigurationSet.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { JobApplicationRepository } from "../../repositories/jobApplicationRepository.js";

const ses = new SESClient({});
const repo = new JobApplicationRepository();
const auditRepo = new AuditRepository();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function json(body: object, statusCode = 200) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

async function sendSes(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  if (env.sesMock) {
    console.info(JSON.stringify({ msg: "careers_ses_mock", to: params.to, subject: params.subject }));
    return;
  }
  const from = env.careersFromEmail;
  if (!from) return;
  await ses.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [params.to] },
      Message: {
        Subject: { Data: params.subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: params.html, Charset: "UTF-8" },
          Text: { Data: params.text, Charset: "UTF-8" },
        },
      },
      ...sesConfigurationSetFields(),
    }),
  );
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (event.requestContext.http.method === "OPTIONS") {
    return withCorrelationHeaders(event, { statusCode: 204, headers: CORS, body: "" });
  }
  if (event.requestContext.http.method !== "POST") {
    return withCorrelationHeaders(event, json({ error: "Method not allowed" }, 405));
  }
  if (!env.enableHiring) {
    return withCorrelationHeaders(event, json({ error: "Feature is not available" }, 503));
  }
  if (!env.jobApplicationsTable) {
    console.error(JSON.stringify({ msg: "careers_apply_error", error: "JOB_APPLICATIONS_TABLE not set" }));
    return withCorrelationHeaders(event, json({ error: "Service unavailable" }, 500));
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(event.body ?? "{}");
  } catch {
    return withCorrelationHeaders(event, json({ error: "Invalid JSON" }, 400));
  }

  const parsed = careersApplyBodySchema.safeParse(parsedJson);
  if (!parsed.success) {
    return withCorrelationHeaders(
      event,
      json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, 400),
    );
  }

  const body = parsed.data;
  const now = new Date().toISOString();
  const applicationId = randomUUID();
  const positionLabel = positionDisplayName(body.position);

  const item: JobApplication = {
    applicationId,
    agencyId: "platform",
    position: body.position,
    source: body.source,
    firstName: body.firstName.trim(),
    lastName: body.lastName.trim(),
    email: body.email.trim().toLowerCase(),
    phone: body.phone?.trim() || undefined,
    linkedInUrl: body.linkedInUrl?.trim() || undefined,
    yearsExperience: body.yearsExperience?.trim() || undefined,
    weeklyAvailability: body.weeklyAvailability?.trim() || undefined,
    coverNote: body.coverNote?.trim() || undefined,
    resumeKey: body.resumeKey?.trim() || undefined,
    resumeFileName: body.resumeFileName?.trim() || undefined,
    status: "NEW",
    notes: [],
    activities: [
      {
        activityId: randomUUID(),
        type: "status_change",
        description: "Application received via careers page",
        authorName: "System",
        createdAt: now,
        metadata: { newStatus: "NEW", source: body.source },
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  try {
    await repo.put(item);

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: "platform",
      actorId: "public",
      type: AUDIT_EVENT_TYPES.JOB_APPLICATION_CREATED,
      details: {
        applicationId,
        position: body.position,
        source: body.source,
        emailDomain: item.email.split("@")[1] ?? "",
      },
      createdAt: now,
      resourceType: "job_application",
      resourceId: applicationId,
    });

    const confirmHtml = `<p>Hi ${item.firstName},</p>
<p>Thank you for applying for the <strong>${positionLabel}</strong> role at Rapid Cortex. We have received your application and will review it shortly.</p>
<p>You can revisit open roles anytime at <a href="https://www.rapidcortex.us/careers">www.rapidcortex.us/careers</a>.</p>
<p>— The Rapid Cortex Team<br>careers@rapidcortex.us</p>`;
    const confirmText = [
      `Hi ${item.firstName},`,
      "",
      `Thank you for applying for the ${positionLabel} role at Rapid Cortex. We have received your application and will review it shortly.`,
      "",
      "Open roles: https://www.rapidcortex.us/careers",
      "",
      "— The Rapid Cortex Team",
      "careers@rapidcortex.us",
    ].join("\n");

    try {
      await sendSes({
        to: item.email,
        subject: "We received your Rapid Cortex application",
        html: confirmHtml,
        text: confirmText,
      });
    } catch (emailErr) {
      console.error(
        JSON.stringify({
          msg: "careers_confirm_email_failed",
          applicationId,
          error: emailErr instanceof Error ? emailErr.message : String(emailErr),
        }),
      );
    }

    const notifyTo = env.careersNotifyEmail;
    if (notifyTo) {
      const summary = [
        `New application: ${item.firstName} ${item.lastName}`,
        `Email: ${item.email}`,
        `Phone: ${item.phone ?? "—"}`,
        `LinkedIn: ${item.linkedInUrl ?? "—"}`,
        `Experience: ${item.yearsExperience ?? "—"}`,
        `Availability: ${item.weeklyAvailability ?? "—"}`,
        `Resume: ${item.resumeFileName ?? item.resumeKey ?? "—"}`,
        "",
        item.coverNote ?? "(no cover note)",
        "",
        `ATS: /rc-admin/hiring`,
      ].join("\n");
      try {
        await sendSes({
          to: notifyTo,
          subject: `[Hiring] New application — ${item.firstName} ${item.lastName}`,
          html: `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap;">${summary.replace(/</g, "&lt;")}</pre>`,
          text: summary,
        });
      } catch (notifyErr) {
        console.error(
          JSON.stringify({
            msg: "careers_notify_email_failed",
            applicationId,
            error: notifyErr instanceof Error ? notifyErr.message : String(notifyErr),
          }),
        );
      }
    }

    return withCorrelationHeaders(event, json({ ok: true, applicationId }));
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "careers_apply_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return withCorrelationHeaders(event, json({ error: "Failed to submit application" }, 500));
  }
};
