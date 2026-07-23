/**
 * RC Admin Leads CRM router — all routes under /api/rc-admin/leads/* [CR-1].
 * Covers pipeline, get-by-id, stage, notes, attribution-summary, and activity log.
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  addSalesLeadActivityBodySchema,
  addSalesLeadNoteBodySchema,
  canAccessRcFinancePortal,
  patchSalesLeadBodySchema,
  patchSalesLeadStageBodySchema,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { makeId } from "../../lib/ids.js";
import {
  badRequestFromZod,
  forbidden,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { SalesLeadRepository } from "../../repositories/salesLeadRepository.js";

const repo = new SalesLeadRepository();
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

function pathOf(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return event.rawPath ?? "";
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  if (!canAccessRcFinancePortal(user.role)) return forbidden();

  const m = method(event);
  const path = pathOf(event);
  const leadId = event.pathParameters?.leadId?.trim();
  const noteId = event.pathParameters?.noteId?.trim();

  try {
    if (m === "GET" && path.endsWith("/pipeline")) {
      const leads = await repo.listNormalized(500);
      const data = repo.buildPipelinePayload(leads);
      return ok({ success: true, data });
    }

    if (m === "GET" && path.endsWith("/attribution-summary")) {
      const leads = await repo.listNormalized(500);
      const data = repo.buildAttributionSummary(leads);
      return ok({ success: true, data });
    }

    if (m === "GET" && leadId && !path.includes("/notes")) {
      const item = await repo.getNormalized(leadId);
      if (!item) return ok({ error: "Lead not found" }, 404);
      return ok({ success: true, data: item, item });
    }

    if (m === "PATCH" && leadId && path.endsWith("/stage")) {
      const body = parseBody(event);
      if (body === null) return ok({ error: "Invalid JSON body" }, 400);
      const parsed = patchSalesLeadStageBodySchema.safeParse(body);
      if (!parsed.success) return badRequestFromZod(parsed.error);

      const updated = await repo.updateStage(leadId, {
        stage: parsed.data.stage,
        note: parsed.data.note,
        lostReason: parsed.data.lostReason,
        pilotStartDate: parsed.data.pilotStartDate,
        changedBy: user.userId,
        changedByName: user.email ?? user.userId,
      });
      if (!updated) return ok({ error: "Lead not found" }, 404);

      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SALES_LEAD_STAGE_CHANGED,
        details: {
          leadId,
          to: parsed.data.stage,
          lostReason: parsed.data.lostReason,
        },
        createdAt: new Date().toISOString(),
        resourceType: "sales_lead",
        resourceId: leadId,
      });

      return ok({ success: true, data: updated, item: updated });
    }

    // CRM field patch — also exposed as /fields so surgical stacks can avoid
    // colliding with the legacy PATCH /leads/{leadId} Lambda.
    if (
      m === "PATCH" &&
      leadId &&
      !path.endsWith("/stage") &&
      (path.endsWith("/fields") || path.endsWith(`/${leadId}`))
    ) {
      const body = parseBody(event);
      if (body === null) return ok({ error: "Invalid JSON body" }, 400);
      const parsed = patchSalesLeadBodySchema.safeParse(body);
      if (!parsed.success) return badRequestFromZod(parsed.error);

      const updated = await repo.updateCrmFields(leadId, {
        ...parsed.data,
        updatedBy: user.userId,
        updatedByName: user.email ?? user.userId,
      });
      if (!updated) return ok({ error: "Lead not found" }, 404);

      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SALES_LEAD_UPDATED,
        details: { leadId, fields: Object.keys(parsed.data) },
        createdAt: new Date().toISOString(),
        resourceType: "sales_lead",
        resourceId: leadId,
      });

      return ok({ success: true, data: updated, item: updated });
    }

    if (m === "POST" && leadId && path.endsWith("/notes")) {
      const body = parseBody(event);
      if (body === null) return ok({ error: "Invalid JSON body" }, 400);
      const parsed = addSalesLeadNoteBodySchema.safeParse(body);
      if (!parsed.success) return badRequestFromZod(parsed.error);

      const updated = await repo.addNote(leadId, {
        text: parsed.data.text,
        pinned: parsed.data.pinned,
        authorId: user.userId,
        authorName: user.email ?? user.userId,
      });
      if (!updated) return ok({ error: "Lead not found" }, 404);

      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SALES_LEAD_NOTE_ADDED,
        details: { leadId },
        createdAt: new Date().toISOString(),
        resourceType: "sales_lead",
        resourceId: leadId,
      });

      return ok({ success: true, data: updated, item: updated });
    }

    if (m === "POST" && leadId && path.endsWith("/activities")) {
      const body = parseBody(event);
      if (body === null) return ok({ error: "Invalid JSON body" }, 400);
      const parsed = addSalesLeadActivityBodySchema.safeParse(body);
      if (!parsed.success) return badRequestFromZod(parsed.error);

      const updated = await repo.addActivity(leadId, {
        type: parsed.data.type,
        description: parsed.data.description,
        metadata: parsed.data.metadata,
        authorId: user.userId,
        authorName: user.email ?? user.userId,
      });
      if (!updated) return ok({ error: "Lead not found" }, 404);
      return ok({ success: true, data: updated, item: updated });
    }

    if (m === "DELETE" && leadId && noteId && path.includes("/notes/")) {
      const role = String(user.role ?? "").toLowerCase();
      if (role !== "rcsuperadmin") return forbidden();
      const updated = await repo.deleteNote(leadId, noteId);
      if (!updated) return ok({ error: "Lead not found" }, 404);
      return ok({ success: true, data: updated, item: updated });
    }

    return ok({ error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof Error && error.message === "SALES_LEADS_TABLE_NOT_CONFIGURED") {
      return ok({ error: "Sales leads not configured" }, 503);
    }
    console.error("[rcAdminLeadsHttp]", error);
    return serverError();
  }
};
