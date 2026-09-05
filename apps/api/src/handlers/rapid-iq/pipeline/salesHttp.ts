/**
 * Sales automation HTTP API.
 * Routes: /api/rapid-iq/sales-automation/*
 * RBAC: canAccessRapidIq (already enforced by signalHttp).
 */

import type { APIGatewayProxyEventV2 } from "aws-lambda";
import {
  createRapidIqSalesSequenceBodySchema,
  type UserContext,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../../../lib/ids.js";
import { env } from "../../../lib/env.js";
import {
  getSalesDraft,
  getSalesSequence,
  listSalesDrafts,
  listSalesSequences,
  putSalesDraft,
} from "../../../lib/rapid-iq/sales-automation-db.js";
import {
  approveSequence,
  computeSalesMetrics,
  createSequenceFromTrigger,
  listCampaignCards,
  suppressSequence,
} from "../../../lib/rapid-iq/sales-automation-engine.js";
import { ConferenceRepository } from "../../../repositories/conferenceRepository.js";
import {
  badRequest,
  badRequestFromZod,
  notFound,
  ok,
  serviceUnavailable,
} from "../../../lib/response.js";
import { AuditRepository } from "../../../repositories/auditRepository.js";

const auditRepo = new AuditRepository();

function parseBody(event: APIGatewayProxyEventV2): unknown {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function audit(
  user: UserContext,
  type: string,
  resourceId: string,
  details: Record<string, unknown>,
): Promise<void> {
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: "platform",
    actorId: user.userId,
    type,
    details,
    createdAt: new Date().toISOString(),
    resourceType: "rapid_iq_sales_seq",
    resourceId,
  });
}

function seqIdFromPath(path: string, params?: Record<string, string | undefined>): string | undefined {
  if (params?.sequenceId?.trim()) return params.sequenceId.trim();
  const m = path.match(/\/sales-automation\/sequences\/([^/]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : undefined;
}

function draftIdFromPath(path: string, params?: Record<string, string | undefined>): string | undefined {
  if (params?.draftId?.trim()) return params.draftId.trim();
  const m = path.match(/\/sales-automation\/drafts\/([^/]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : undefined;
}

export async function handleSalesAutomationHttp(
  event: APIGatewayProxyEventV2,
  user: UserContext,
): Promise<ReturnType<typeof ok>> {
  if (!env.enableSalesAutomation) {
    return serviceUnavailable("Sales automation is not enabled");
  }
  const method = (event.requestContext.http?.method ?? "GET").toUpperCase();
  const path = event.rawPath ?? event.requestContext.http?.path ?? "";
  const seqId = seqIdFromPath(path, event.pathParameters);
  const draftId = draftIdFromPath(path, event.pathParameters);

  if (method === "GET" && path.includes("/sales-automation/metrics")) {
    const metrics = await computeSalesMetrics();
    return ok({ metrics });
  }

  if (method === "GET" && path.includes("/sales-automation/campaigns")) {
    let conferences: Awaited<ReturnType<ConferenceRepository["listByAgency"]>> = [];
    if (env.conferencesTable) {
      try {
        conferences = await new ConferenceRepository().listByAgency();
      } catch (err) {
        console.warn(
          JSON.stringify({
            msg: "rapid_iq_sales_campaigns_conferences_failed",
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }
    return ok({ campaigns: listCampaignCards(conferences) });
  }

  if (method === "GET" && (path.endsWith("/sales-automation/drafts") || path.endsWith("/sales-automation/drafts/"))) {
    const drafts = await listSalesDrafts(50);
    return ok({ drafts });
  }

  if (draftId && path.includes("/sales-automation/drafts/")) {
    if (method === "POST" && path.endsWith("/approve")) {
      const draft = await getSalesDraft(draftId);
      if (!draft) return notFound("Draft not found");
      const next = { ...draft, status: "approved" as const, updatedAt: new Date().toISOString() };
      await putSalesDraft(next);
      await audit(user, AUDIT_EVENT_TYPES.RAPID_IQ_SALES_DRAFT_APPROVED, draftId, { contentType: draft.contentType });
      return ok({ draft: next });
    }
    if (method === "GET") {
      const draft = await getSalesDraft(draftId);
      if (!draft) return notFound("Draft not found");
      return ok({ draft });
    }
  }

  if (method === "GET" && (path.endsWith("/sales-automation/sequences") || path.endsWith("/sales-automation/sequences/"))) {
    const sequences = await listSalesSequences(100);
    return ok({ sequences });
  }

  if (method === "POST" && (path.endsWith("/sales-automation/sequences") || path.endsWith("/sales-automation/sequences/"))) {
    const body = parseBody(event);
    if (body === null) return badRequest("Invalid JSON");
    const parsed = createRapidIqSalesSequenceBodySchema.safeParse(body);
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const sequence = await createSequenceFromTrigger(parsed.data);
    await audit(user, AUDIT_EVENT_TYPES.RAPID_IQ_SALES_SEQ_CREATED, sequence.sequenceId, {
      triggerType: sequence.triggerType,
      status: sequence.status,
    });
    return ok({ sequence });
  }

  if (seqId && path.includes("/sales-automation/sequences/")) {
    if (method === "POST" && path.endsWith("/approve")) {
      try {
        const sequence = await approveSequence(seqId, user.userId);
        await audit(
          user,
          sequence.status === "suppressed"
            ? AUDIT_EVENT_TYPES.RAPID_IQ_SALES_SEQ_SUPPRESSED
            : AUDIT_EVENT_TYPES.RAPID_IQ_SALES_SEQ_APPROVED,
          seqId,
          { status: sequence.status, reason: sequence.suppressedReason },
        );
        return ok({ sequence });
      } catch (err) {
        return badRequest(err instanceof Error ? err.message : "Approve failed");
      }
    }
    if (method === "POST" && path.endsWith("/suppress")) {
      try {
        const sequence = await suppressSequence(seqId, "manual");
        await audit(user, AUDIT_EVENT_TYPES.RAPID_IQ_SALES_SEQ_SUPPRESSED, seqId, { reason: "manual" });
        return ok({ sequence });
      } catch (err) {
        return badRequest(err instanceof Error ? err.message : "Suppress failed");
      }
    }
    if (method === "GET") {
      const sequence = await getSalesSequence(seqId);
      if (!sequence) return notFound("Sequence not found");
      return ok({ sequence });
    }
  }

  return notFound("Not found");
}
