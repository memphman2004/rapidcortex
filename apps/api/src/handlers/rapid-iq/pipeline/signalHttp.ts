/**
 * HTTP API for Rapid IQ procurement pipeline signals.
 * Routes under /api/rapid-iq/pipeline/signals*
 * RBAC: rcsuperadmin / rcadmin (canAccessRapidIq).
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  canAccessRapidIq,
  patchRapidIqPipelineSignalBodySchema,
  pushRapidIqPipelineToCrmBodySchema,
  RAPID_IQ_PIPELINE_SIGNAL_STATUSES,
  type UserContext,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../../lib/auth.js";
import { withCorrelationHeaders } from "../../../lib/correlation.js";
import { env } from "../../../lib/env.js";
import { makeId } from "../../../lib/ids.js";
import { getCreditStatus } from "../../../lib/rapid-iq/pipeline/credit-guard.js";
import {
  getSignal,
  listAllSignals,
  listSignalsByStatus,
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
  const m = path.match(/\/pipeline\/signals\/([^/]+)/);
  return m?.[1];
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = await requirePipelineAdmin(event);
    if ("error" in auth) return withCorrelationHeaders(event, auth.error);
    const { user } = auth;

    const method = (event.requestContext.http?.method ?? "GET").toUpperCase();
    const path = event.rawPath ?? event.requestContext.http?.path ?? "";
    const signalId = signalIdFromPath(path, event.pathParameters);

    // GET /api/rapid-iq/pipeline/credits
    if (
      method === "GET" &&
      (path.endsWith("/pipeline/credits") || path.endsWith("/pipeline/credits/"))
    ) {
      const credits = await getCreditStatus();
      return withCorrelationHeaders(event, ok({ credits }));
    }

    // GET /api/rapid-iq/pipeline/signals
    if (method === "GET" && (path.endsWith("/pipeline/signals") || path.endsWith("/pipeline/signals/"))) {
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
        signals = await listAllSignals();
      }
      return withCorrelationHeaders(event, ok({ signals, items: signals }));
    }

    if (!signalId) {
      return withCorrelationHeaders(event, notFound("Not found"));
    }

    // PATCH /api/rapid-iq/pipeline/signals/{signalId}
    if (method === "PATCH" && !path.endsWith("/push-to-crm")) {
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const parsed = patchRapidIqPipelineSignalBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));

      const updated = await updateSignalStatus(signalId, parsed.data.status, {
        reviewedBy: user.email ?? user.userId,
      });

      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: "platform",
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.RAPID_IQ_PIPELINE_SIGNAL_UPDATED,
        details: { status: parsed.data.status },
        createdAt: new Date().toISOString(),
        resourceType: "rapid_iq_pipeline_signal",
        resourceId: signalId,
      });

      return withCorrelationHeaders(event, ok({ signal: updated }));
    }

    // POST /api/rapid-iq/pipeline/signals/{signalId}/push-to-crm
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

    // GET single signal
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
