/**
 * GET/PUT /api/agency/{agencyId}/config/ai-mode
 * GET     /api/agency/{agencyId}/config/ai-mode/audit
 */

import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import {
  AI_GATE_FEATURES,
  applyToggle,
  type AIGateAuditRecord,
  type AuditEventType,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES, canReadAIGateConfig, canToggleAIGate } from "rapid-cortex-security";
import {
  ACCOUNT_INACTIVE_MESSAGE,
  getUserContext,
  isUserAccountActive,
} from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { emitAIGateMetric } from "../../lib/ai-gate-metrics.js";
import { makeId } from "../../lib/ids.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { broadcastToAgency } from "../../lib/ws-broadcast.js";
import { AIGateRepository } from "../../repositories/aiGateRepository.js";
import { AuditRepository } from "../../repositories/auditRepository.js";

const repo = new AIGateRepository();
const auditRepo = new AuditRepository();

const FeatureMapSchema = z
  .object(
    Object.fromEntries(AI_GATE_FEATURES.map((k) => [k, z.boolean().optional()])) as Record<
      (typeof AI_GATE_FEATURES)[number],
      z.ZodOptional<z.ZodBoolean>
    >,
  )
  .partial();

const ToggleSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().max(500).optional(),
  features: FeatureMapSchema.optional(),
});

function routeParts(event: { rawPath?: string; requestContext?: { http?: { method?: string; path?: string } } }) {
  const method = (event.requestContext?.http?.method ?? "GET").toUpperCase();
  const path = event.rawPath ?? event.requestContext?.http?.path ?? "";
  return { method, path };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }

    const agencyId = event.pathParameters?.agencyId?.trim() ?? "";
    if (!agencyId) return withCorrelationHeaders(event, badRequest("agencyId required"));

    const { method, path } = routeParts(event);
    const isAudit = path.includes("/config/ai-mode/audit");

    if (method === "GET" && isAudit) {
      if (!canToggleAIGate(user, agencyId)) {
        return withCorrelationHeaders(event, forbidden("Forbidden"));
      }
      const limit = Math.min(Number(event.queryStringParameters?.limit ?? 50), 200);
      const history = await repo.listAuditHistory(agencyId, limit);
      return withCorrelationHeaders(event, ok({ history }));
    }

    if (method === "GET") {
      if (!canReadAIGateConfig(user, agencyId)) {
        return withCorrelationHeaders(event, forbidden("Forbidden"));
      }
      const config = await repo.getConfig(agencyId);
      return withCorrelationHeaders(event, ok(config));
    }

    if (method === "PUT") {
      if (!canToggleAIGate(user, agencyId)) {
        return withCorrelationHeaders(
          event,
          forbidden("Forbidden — supervisor or agency admin required"),
        );
      }

      let body: unknown;
      try {
        body = JSON.parse(event.body ?? "{}");
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      }

      const parsed = ToggleSchema.safeParse(body);
      if (!parsed.success) {
        return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      }

      const req = parsed.data;
      const current = await repo.getConfig(agencyId);
      const next = applyToggle(current, req, user.userId);

      const action: AIGateAuditRecord["action"] =
        req.enabled !== current.aiEnabled
          ? req.enabled
            ? "AI_ENABLED"
            : "AI_DISABLED"
          : "FEATURE_CHANGED";

      const audit: AIGateAuditRecord = {
        agencyId,
        auditedAt: next.toggledAt,
        auditedBy: user.userId,
        auditedByDisplay: user.displayName ?? user.userId,
        action,
        previousState: { aiEnabled: current.aiEnabled, ...current.features },
        newState: { aiEnabled: next.aiEnabled, ...next.features },
        reason: req.reason ?? null,
      };

      await repo.putConfigWithAudit(next, audit);

      const auditType =
        action === "AI_ENABLED"
          ? AUDIT_EVENT_TYPES.AI_GATE_ENABLED
          : action === "AI_DISABLED"
            ? AUDIT_EVENT_TYPES.AI_GATE_DISABLED
            : AUDIT_EVENT_TYPES.AI_GATE_FEATURE_CHANGED;

      await Promise.allSettled([
        broadcastToAgency(agencyId, {
          type: "AI_MODE_CHANGE",
          agencyId,
          aiEnabled: next.aiEnabled,
          features: next.features,
          toggledAt: next.toggledAt,
        }),
        emitAIGateMetric(agencyId, next.aiEnabled),
        auditRepo.create({
          eventId: makeId("audit"),
          agencyId,
          actorId: user.userId,
          type: auditType as AuditEventType,
          details: {
            action,
            previous: audit.previousState,
            next: audit.newState,
            reason: audit.reason,
          },
          resourceType: "agency_config",
          resourceId: agencyId,
          createdAt: next.toggledAt,
        }),
      ]);

      return withCorrelationHeaders(event, ok(next));
    }

    return withCorrelationHeaders(event, notFound("Unknown route"));
  } catch (err) {
    if (err && typeof err === "object" && "issues" in err) {
      return withCorrelationHeaders(event, badRequestFromZod(err as never));
    }
    console.error(JSON.stringify({ msg: "ai_gate_http_error", error: String(err) }));
    return withCorrelationHeaders(event, serverError());
  }
};
