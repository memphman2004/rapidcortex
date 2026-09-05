/**
 * HTTP API for Rapid IQ procurement pipeline signals.
 * Routes: /api/rapid-iq/signals* (legacy /api/rapid-iq/pipeline/signals* still accepted).
 * RBAC: rcsuperadmin / rcadmin (canAccessRapidIq).
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  canAccessRapidIq,
  createManualRapidIqPipelineSignalBodySchema,
  enqueueRapidIqPipelineFromOpportunityBodySchema,
  patchRapidIqPipelineSignalBodySchema,
  pushRapidIqPipelineToCrmBodySchema,
  RAPID_IQ_PIPELINE_SIGNAL_STATUSES,
  rapidIqResearchRequestSchema,
  type UserContext,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../../lib/auth.js";
import { withCorrelationHeaders } from "../../../lib/correlation.js";
import { env } from "../../../lib/env.js";
import { makeId } from "../../../lib/ids.js";
import { runRapidIqResearch } from "../../../lib/rapid-iq/pipeline/ai-research.js";
import { getCreditStatus } from "../../../lib/rapid-iq/pipeline/credit-guard.js";
import { createManualPipelineSignal } from "../../../lib/rapid-iq/pipeline/create-manual-signal.js";
import { enqueueOpportunityToPipeline } from "../../../lib/rapid-iq/pipeline/enqueue-from-opportunity.js";
import {
  getAgencyProfile,
  getSignal,
  listAgencyContacts,
  listAgencyProfiles,
  listAgencySignalLinks,
  listAllSignals,
  listSignalsByStatus,
  updateSignalFields,
  updateSignalStatus,
} from "../../../lib/rapid-iq/pipeline/rapid-iq-pipeline-db.js";
import {
  badRequest,
  badRequestFromZod,
  conflict,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../../lib/response.js";
import { AuditRepository } from "../../../repositories/auditRepository.js";
import { handleIntelHttp } from "./intelHttp.js";
import { handleSalesAutomationHttp } from "./salesHttp.js";
import { createCrmLeadFromPipelineSignal } from "./push-to-crm.js";

const auditRepo = new AuditRepository();

type JsonResult = ReturnType<typeof ok>;

async function requirePipelineAdmin(
  event: APIGatewayProxyEventV2,
): Promise<{ error: JsonResult } | { user: UserContext }> {
  const user = await getUserContext(event);
  if (!user) return { error: unauthorized() };
  if (!isUserAccountActive(user)) return { error: unauthorized(ACCOUNT_INACTIVE_MESSAGE) };
  if (!env.enableRapidIqPipeline) {
    return { error: serviceUnavailable("Rapid IQ Pipeline is not enabled") };
  }
  if (!canAccessRapidIq(user.role)) return { error: forbidden() };
  return { user };
}

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

function signalIdFromPath(path: string, params?: { signalId?: string }): string | undefined {
  if (params?.signalId?.trim()) return params.signalId.trim();
  const m =
    path.match(/\/rapid-iq\/signals\/([^/]+)/) ?? path.match(/\/pipeline\/signals\/([^/]+)/);
  return m?.[1];
}

function agencyIdFromPath(path: string, params?: { agencyId?: string }): string | undefined {
  if (params?.agencyId?.trim()) return params.agencyId.trim();
  const m = path.match(/\/agencies\/([^/]+)/);
  return m?.[1] ? decodeURIComponent(m[1]) : undefined;
}

function isCreditsPath(path: string): boolean {
  return (
    path.endsWith("/rapid-iq/credits") ||
    path.endsWith("/rapid-iq/credits/") ||
    path.endsWith("/pipeline/credits") ||
    path.endsWith("/pipeline/credits/")
  );
}

function isSignalsCollectionPath(path: string): boolean {
  return (
    path.endsWith("/rapid-iq/signals") ||
    path.endsWith("/rapid-iq/signals/") ||
    path.endsWith("/pipeline/signals") ||
    path.endsWith("/pipeline/signals/")
  );
}

function isResearchPath(path: string): boolean {
  return (
    path.endsWith("/rapid-iq/research") ||
    path.endsWith("/rapid-iq/research/") ||
    path.endsWith("/pipeline/research") ||
    path.endsWith("/pipeline/research/")
  );
}

function isAgenciesCollectionPath(path: string): boolean {
  return (
    path.endsWith("/rapid-iq/agencies") ||
    path.endsWith("/rapid-iq/agencies/") ||
    path.endsWith("/pipeline/agencies") ||
    path.endsWith("/pipeline/agencies/")
  );
}

function isManualBody(body: unknown): boolean {
  return Boolean(body && typeof body === "object" && (body as { manualEntry?: unknown }).manualEntry === true);
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = await requirePipelineAdmin(event);
    if ("error" in auth) return withCorrelationHeaders(event, auth.error);
    const { user } = auth;

    const method = (event.requestContext.http?.method ?? "GET").toUpperCase();
    const path = event.rawPath ?? event.requestContext.http?.path ?? "";

    if (path.includes("/rapid-iq/intel")) {
      return withCorrelationHeaders(event, await handleIntelHttp(event, user));
    }
    if (path.includes("/rapid-iq/sales-automation")) {
      return withCorrelationHeaders(event, await handleSalesAutomationHttp(event, user));
    }

    const signalId = signalIdFromPath(path, event.pathParameters);
    const agencyId = agencyIdFromPath(path, event.pathParameters);

    if (method === "GET" && isCreditsPath(path)) {
      const credits = await getCreditStatus();
      return withCorrelationHeaders(event, ok({ credits }));
    }

    if (method === "POST" && isResearchPath(path)) {
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = rapidIqResearchRequestSchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const result = await runRapidIqResearch(parsed.data);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.RAPID_IQ_PIPELINE_RESEARCH_QUERY,
        details: { query: parsed.data.query.slice(0, 200), signalCount: result.supportingSignals.length },
        createdAt: new Date().toISOString(),
        resourceType: "rapid_iq_pipeline_signal",
        resourceId: "research",
      });
      return withCorrelationHeaders(event, ok(result));
    }

    if (method === "GET" && isAgenciesCollectionPath(path)) {
      const agencies = await listAgencyProfiles(200);
      return withCorrelationHeaders(event, ok({ agencies }));
    }

    if (method === "GET" && agencyId && path.includes("/agencies/")) {
      const profile = await getAgencyProfile(agencyId);
      if (!profile) return withCorrelationHeaders(event, notFound("Agency not found"));
      const contacts = await listAgencyContacts(agencyId);
      contacts.sort((a, b) => b.confidence - a.confidence);
      const links = await listAgencySignalLinks(agencyId);
      const signals = (
        await Promise.all(links.map((l) => getSignal(l.signalId)))
      ).filter((s): s is NonNullable<typeof s> => Boolean(s));
      return withCorrelationHeaders(event, ok({ agency: profile, contacts, signals }));
    }

    if (method === "GET" && isSignalsCollectionPath(path)) {
      const statusParam = event.queryStringParameters?.status;
      let signals;
      if (
        statusParam &&
        (RAPID_IQ_PIPELINE_SIGNAL_STATUSES as readonly string[]).includes(statusParam)
      ) {
        signals = await listSignalsByStatus(
          statusParam as (typeof RAPID_IQ_PIPELINE_SIGNAL_STATUSES)[number],
        );
      } else {
        signals = await listAllSignals(200);
      }
      return withCorrelationHeaders(event, ok({ signals, items: signals }));
    }

    if (method === "POST" && isSignalsCollectionPath(path)) {
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));

      if (isManualBody(body)) {
        const parsed = createManualRapidIqPipelineSignalBodySchema.safeParse(body);
        if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
        const { signal, alreadyQueued } = await createManualPipelineSignal(
          parsed.data,
          user.email ?? user.userId,
        );
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: "platform",
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.RAPID_IQ_PIPELINE_SIGNAL_UPDATED,
          details: { action: "manual_entry", alreadyQueued, sourceId: "manual" },
          createdAt: new Date().toISOString(),
          resourceType: "rapid_iq_pipeline_signal",
          resourceId: signal.signalId,
        });
        return withCorrelationHeaders(event, ok({ signal, alreadyQueued }));
      }

      const parsed = enqueueRapidIqPipelineFromOpportunityBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));

      const { signal, alreadyQueued } = await enqueueOpportunityToPipeline(parsed.data);

      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.RAPID_IQ_PIPELINE_SIGNAL_UPDATED,
        details: {
          action: "queued_from_opportunity",
          opportunityId: parsed.data.opportunityId,
          alreadyQueued,
        },
        createdAt: new Date().toISOString(),
        resourceType: "rapid_iq_pipeline_signal",
        resourceId: signal.signalId,
      });

      return withCorrelationHeaders(event, ok({ signal, alreadyQueued }));
    }

    if (!signalId) {
      return withCorrelationHeaders(event, notFound("Not found"));
    }

    if (method === "PATCH" && !path.endsWith("/push-to-crm")) {
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = patchRapidIqPipelineSignalBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));

      const updated = parsed.data.status
        ? await updateSignalFields(signalId, {
            status: parsed.data.status,
            procurementStage: parsed.data.procurementStage,
          })
        : await updateSignalFields(signalId, { procurementStage: parsed.data.procurementStage });

      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.RAPID_IQ_PIPELINE_SIGNAL_UPDATED,
        details: {
          status: parsed.data.status,
          procurementStage: parsed.data.procurementStage,
        },
        createdAt: new Date().toISOString(),
        resourceType: "rapid_iq_pipeline_signal",
        resourceId: signalId,
      });

      return withCorrelationHeaders(event, ok({ signal: updated }));
    }

    if (method === "POST" && path.endsWith("/push-to-crm")) {
      const signal = await getSignal(signalId);
      if (!signal) return withCorrelationHeaders(event, notFound("Signal not found"));
      if (signal.status === "pushed") {
        return withCorrelationHeaders(event, conflict("Signal already pushed to CRM"));
      }

      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = pushRapidIqPipelineToCrmBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));

      const caller = user.email ?? user.userId;
      const { leadId, enrichment } = await createCrmLeadFromPipelineSignal(
        signal,
        parsed.data,
        caller,
      );
      const updated = await updateSignalStatus(signalId, "pushed", {
        reviewedBy: caller,
        crmLeadId: leadId,
      });

      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.RAPID_IQ_PIPELINE_PUSHED_TO_CRM,
        details: {
          leadId,
          apolloCreditsUsed: enrichment.apolloCreditsUsed,
          hunterCreditsUsed: enrichment.hunterCreditsUsed,
        },
        createdAt: new Date().toISOString(),
        resourceType: "rapid_iq_pipeline_signal",
        resourceId: signalId,
      });

      return withCorrelationHeaders(
        event,
        ok({ success: true, leadId, enrichment, signal: updated }),
      );
    }

    if (method === "GET") {
      const signal = await getSignal(signalId);
      if (!signal) return withCorrelationHeaders(event, notFound("Signal not found"));
      return withCorrelationHeaders(event, ok({ signal }));
    }

    return withCorrelationHeaders(event, badRequest("Method not allowed"));
  } catch (err) {
    console.error("Rapid IQ pipeline signal handler error:", err);
    return withCorrelationHeaders(event, serverError());
  }
}
