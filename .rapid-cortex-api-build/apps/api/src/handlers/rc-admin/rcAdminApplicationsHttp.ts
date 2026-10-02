/**
 * RC Admin Hiring ATS router — /api/rc-admin/applications/*
 */
import { randomUUID } from "node:crypto";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  addApplicationNoteBodySchema,
  canAccessRcFinancePortal,
  EMAIL_TRIGGERS,
  positionDisplayName,
  updateApplicationBodySchema,
  type JobApplication,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { buildEmail } from "../../careers/hiring-email-templates.js";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import {
  badRequestFromZod,
  forbidden,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { sesConfigurationSetFields } from "../../lib/ses/sesConfigurationSet.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { JobApplicationRepository } from "../../repositories/jobApplicationRepository.js";

const repo = new JobApplicationRepository();
const auditRepo = new AuditRepository();
const s3 = new S3Client({});
const ses = new SESClient({});

function method(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return (event.requestContext as { http?: { method?: string } }).http?.method ?? "GET";
}

function parseBody(event: Parameters<APIGatewayProxyHandlerV2>[0]): unknown {
  try {
    const raw =
      event.isBase64Encoded && event.body
        ? Buffer.from(event.body, "base64").toString("utf8")
        : (event.body ?? "{}");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function pathOf(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return event.rawPath ?? "";
}

function displayCallerName(user: {
  email?: string | null;
  userId: string;
  displayName?: string | null;
}): string {
  return user.displayName?.trim() || user.email?.trim() || env.careersReviewerName || user.userId;
}

async function sendStatusEmail(opts: {
  status: string;
  application: JobApplication;
  schedulingLink?: string;
  customMessage?: string;
  reviewerName: string;
}): Promise<{ sent: boolean; skipped?: string }> {
  const { status, application, schedulingLink, customMessage, reviewerName } = opts;
  if (!EMAIL_TRIGGERS.has(status)) return { sent: false, skipped: "no_template_for_status" };
  if (!application.email) return { sent: false, skipped: "no_applicant_email" };

  const template = buildEmail(status, {
    firstName: application.firstName || "there",
    lastName: application.lastName || "",
    email: application.email,
    position: positionDisplayName(application.position),
    schedulingLink: schedulingLink || undefined,
    customMessage: customMessage || undefined,
    reviewerName,
  });
  if (!template) return { sent: false, skipped: "template_returned_null" };

  if (env.sesMock) {
    console.info(
      JSON.stringify({
        msg: "hiring_status_email_mock",
        to: application.email,
        subject: template.subject,
        status,
      }),
    );
    return { sent: true, skipped: "ses_mock" };
  }

  const from = env.careersFromEmail;
  if (!from) return { sent: false, skipped: "no_from_email" };

  await ses.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [application.email] },
      Message: {
        Subject: { Data: template.subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: template.html, Charset: "UTF-8" },
          Text: { Data: template.text, Charset: "UTF-8" },
        },
      },
      ...sesConfigurationSetFields(),
    }),
  );
  return { sent: true };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return withCorrelationHeaders(event, unauthorized());
  if (!isUserAccountActive(user)) {
    return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
  }
  if (!canAccessRcFinancePortal(user.role)) {
    return withCorrelationHeaders(event, forbidden());
  }
  if (!env.enableHiring) {
    return withCorrelationHeaders(event, ok({ error: "Feature is not available" }, 503));
  }

  const m = method(event);
  const path = pathOf(event);
  const applicationId = event.pathParameters?.applicationId?.trim();
  const authorName = displayCallerName(user);

  try {
    if (m === "GET" && !applicationId) {
      const applications = await repo.list(500);
      const metrics = repo.buildMetrics(applications);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.JOB_APPLICATION_VIEWED,
        details: { count: applications.length },
        createdAt: new Date().toISOString(),
        resourceType: "job_application",
      });
      return withCorrelationHeaders(event, ok({ applications, metrics }));
    }

    if (m === "GET" && applicationId && path.endsWith("/resume-url")) {
      const item = await repo.get(applicationId);
      if (!item?.resumeKey) {
        return withCorrelationHeaders(event, ok({ error: "No resume on file" }, 404));
      }
      const bucket = env.resumesBucket;
      if (!bucket) {
        return withCorrelationHeaders(event, ok({ error: "Service unavailable" }, 500));
      }
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: bucket,
          Key: item.resumeKey,
          ResponseContentDisposition: `attachment; filename="${item.resumeFileName ?? "resume"}"`,
        }),
        { expiresIn: 300 },
      );
      try {
        await repo.appendResumeViewed(applicationId, authorName);
      } catch {
        /* non-fatal */
      }
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.JOB_APPLICATION_RESUME_VIEWED,
        details: { applicationId },
        createdAt: new Date().toISOString(),
        resourceType: "job_application",
        resourceId: applicationId,
      });
      return withCorrelationHeaders(event, ok({ url }));
    }

    if (m === "GET" && applicationId) {
      const item = await repo.get(applicationId);
      if (!item) return withCorrelationHeaders(event, ok({ error: "Application not found" }, 404));
      return withCorrelationHeaders(event, ok(item));
    }

    if (m === "POST" && applicationId && path.endsWith("/notes")) {
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, ok({ error: "Invalid JSON body" }, 400));
      const parsed = addApplicationNoteBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));

      const now = new Date().toISOString();
      const note = {
        noteId: randomUUID(),
        text: parsed.data.text.trim(),
        pinned: parsed.data.pinned ?? false,
        authorName,
        authorId: user.userId,
        createdAt: now,
      };
      const act = {
        activityId: randomUUID(),
        type: "note_added" as const,
        description: `Note added by ${authorName}`,
        authorName,
        createdAt: now,
      };
      const updated = await repo.addNote(applicationId, note, act);
      if (!updated) return withCorrelationHeaders(event, ok({ error: "Application not found" }, 404));

      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.JOB_APPLICATION_NOTE_ADDED,
        details: { applicationId, noteId: note.noteId },
        createdAt: now,
        resourceType: "job_application",
        resourceId: applicationId,
      });
      return withCorrelationHeaders(event, ok(updated));
    }

    if ((m === "PUT" || m === "PATCH") && applicationId) {
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, ok({ error: "Invalid JSON body" }, 400));
      const parsed = updateApplicationBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));

      const patch = parsed.data;
      const emailWillSend = Boolean(
        patch.status && EMAIL_TRIGGERS.has(patch.status) && !patch.skipEmail,
      );

      const updated = await repo.update(applicationId, patch, {
        authorName,
        authorId: user.userId,
        emailWillSend,
      });
      if (!updated) return withCorrelationHeaders(event, ok({ error: "Application not found" }, 404));

      let emailResult: { sent: boolean; skipped?: string } = {
        sent: false,
        skipped: "no_status_change",
      };

      if (patch.status && EMAIL_TRIGGERS.has(patch.status) && !patch.skipEmail) {
        try {
          // customMessage only — never fall back to statusNote (internal).
          emailResult = await sendStatusEmail({
            status: patch.status,
            application: updated,
            schedulingLink: patch.schedulingLink || undefined,
            customMessage: patch.customMessage || undefined,
            reviewerName: authorName,
          });
        } catch (emailErr) {
          console.error(
            JSON.stringify({
              msg: "hiring_status_email_failed",
              applicationId,
              status: patch.status,
              error: emailErr instanceof Error ? emailErr.message : String(emailErr),
            }),
          );
          emailResult = {
            sent: false,
            skipped: emailErr instanceof Error ? emailErr.message : String(emailErr),
          };
        }
      } else if (patch.status && patch.skipEmail) {
        emailResult = { sent: false, skipped: "skip_email" };
      }

      if (patch.status) {
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: "platform",
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.JOB_APPLICATION_STATUS_CHANGED,
          details: {
            applicationId,
            status: patch.status,
            emailSent: emailResult.sent,
          },
          createdAt: new Date().toISOString(),
          resourceType: "job_application",
          resourceId: applicationId,
        });
      }

      return withCorrelationHeaders(event, ok({ ...updated, _email: emailResult }));
    }

    return withCorrelationHeaders(event, ok({ error: "Not found" }, 404));
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "rc_admin_applications_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return withCorrelationHeaders(event, serverError());
  }
};
