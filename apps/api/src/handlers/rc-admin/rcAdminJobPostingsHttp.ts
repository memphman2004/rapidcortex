/**
 * RC Admin job postings CRUD — /api/rc-admin/job-postings/*
 */
import { randomUUID } from "node:crypto";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  canAccessRcFinancePortal,
  createJobPostingBodySchema,
  slugifyJobTitle,
  updateJobPostingBodySchema,
  type JobPosting,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
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
import { AuditRepository } from "../../repositories/auditRepository.js";
import { JobPostingRepository } from "../../repositories/jobPostingRepository.js";

const repo = new JobPostingRepository();
const auditRepo = new AuditRepository();

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

async function requireRcHiringAdmin(event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  const user = await getUserContext(event);
  if (!user) return { error: unauthorized() as ReturnType<typeof unauthorized> };
  if (!isUserAccountActive(user)) {
    return { error: forbidden(ACCOUNT_INACTIVE_MESSAGE) as ReturnType<typeof forbidden> };
  }
  if (!canAccessRcFinancePortal(user.role) || !env.enableHiring) {
    return { error: forbidden() as ReturnType<typeof forbidden> };
  }
  return { user };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const m = method(event);
  const auth = await requireRcHiringAdmin(event);
  if ("error" in auth && auth.error) return withCorrelationHeaders(event, auth.error);
  const user = auth.user!;

  const postingId = event.pathParameters?.postingId?.trim();

  try {
    if (!env.jobPostingsTable) {
      return withCorrelationHeaders(event, serverError("JOB_POSTINGS_TABLE not set"));
    }

    if (m === "GET" && !postingId) {
      const postings = await repo.listAll();
      return withCorrelationHeaders(event, ok({ postings }));
    }

    if (m === "GET" && postingId) {
      const item = await repo.getById(postingId);
      if (!item) {
        return withCorrelationHeaders(event, {
          statusCode: 404,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ error: "Not found" }),
        });
      }
      return withCorrelationHeaders(event, ok(item));
    }

    if (m === "POST" && !postingId) {
      const raw = parseBody(event);
      if (raw === null) {
        return withCorrelationHeaders(event, {
          statusCode: 400,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ error: "Invalid JSON" }),
        });
      }
      const parsed = createJobPostingBodySchema.safeParse(raw);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));

      const now = new Date().toISOString();
      const body = parsed.data;
      if (body.status === "PUBLISHED" && !body.summary.trim()) {
        return withCorrelationHeaders(event, {
          statusCode: 422,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ error: "Summary required to publish" }),
        });
      }

      const item: JobPosting = {
        postingId: randomUUID(),
        slug: `${slugifyJobTitle(body.title) || "role"}-${Date.now().toString(36)}`,
        title: body.title.trim(),
        subtitle: body.subtitle?.trim() || undefined,
        positionKey: body.positionKey.trim(),
        department: body.department?.trim() || undefined,
        engagementType: body.engagementType,
        workLocation: body.workLocation,
        compensationMin: body.compensationMin,
        compensationMax: body.compensationMax,
        compensationUnit: body.compensationUnit,
        summary: body.summary.trim(),
        description: body.description,
        requirements: body.requirements,
        preferredQualifications: body.preferredQualifications,
        whatYouGain: body.whatYouGain,
        technologyList: body.technologyList,
        status: body.status,
        publishedAt: body.status === "PUBLISHED" ? now : undefined,
        applicationCount: 0,
        createdAt: now,
        updatedAt: now,
        agencyId: "platform",
      };

      await repo.put(item);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.JOB_POSTING_CREATED,
        details: { postingId: item.postingId, title: item.title, status: item.status },
        createdAt: now,
        resourceType: "job_posting",
        resourceId: item.postingId,
      });

      return withCorrelationHeaders(event, {
        statusCode: 201,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(item),
      });
    }

    if ((m === "PUT" || m === "PATCH") && postingId) {
      const raw = parseBody(event);
      if (raw === null) {
        return withCorrelationHeaders(event, {
          statusCode: 400,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ error: "Invalid JSON" }),
        });
      }
      const parsed = updateJobPostingBodySchema.safeParse(raw);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));

      const updated = await repo.update(postingId, parsed.data);
      if (!updated) {
        return withCorrelationHeaders(event, {
          statusCode: 404,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ error: "Not found" }),
        });
      }

      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.JOB_POSTING_UPDATED,
        details: {
          postingId,
          status: updated.status,
        },
        createdAt: new Date().toISOString(),
        resourceType: "job_posting",
        resourceId: postingId,
      });

      return withCorrelationHeaders(event, ok(updated));
    }

    return withCorrelationHeaders(event, {
      statusCode: 405,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "rc_admin_job_postings_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return withCorrelationHeaders(event, serverError());
  }
};
