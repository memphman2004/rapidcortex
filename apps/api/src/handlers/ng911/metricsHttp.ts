import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ng911MetricsQuerySchema } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES, AuthorizationService, isSupervisorOrAdmin } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import {
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { buildDataPathExport, buildMetrics, buildNgSecEvidencePack } from "../../services/ng911/metricsService.js";

const authz = new AuthorizationService();
const auditRepo = new AuditRepository();

const DEFAULT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function resolvePeriod(query: { from?: string; to?: string }): { from: string; to: string } {
  const to = query.to ?? new Date().toISOString();
  const from = query.from ?? new Date(Date.parse(to) - DEFAULT_WINDOW_MS).toISOString();
  return { from, to };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableNg911Assist || !env.ng911AssistTable) {
      return withCorrelationHeaders(
        event,
        serviceUnavailable("NG9-1-1 assist is not enabled for this deployment"),
      );
    }

    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }
    if (!isSupervisorOrAdmin(user.role) && !authz.canDispatch(user)) {
      return withCorrelationHeaders(event, forbidden());
    }

    const method = event.requestContext.http.method.toUpperCase();
    const path = event.rawPath ?? "";
    const parsedQuery = ng911MetricsQuerySchema.safeParse(event.queryStringParameters ?? {});
    if (!parsedQuery.success) return withCorrelationHeaders(event, badRequestFromZod(parsedQuery.error));

    if (method === "GET" && path.endsWith("/datapath-export")) {
      const { from, to } = resolvePeriod(parsedQuery.data);
      const pack = await buildDataPathExport(user.agencyId, from, to);

      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: user.agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.CRISIS_DATAPATH_EXPORTED,
        details: { from, to },
        createdAt: new Date().toISOString(),
        resourceType: "agency",
        resourceId: user.agencyId,
      });

      return withCorrelationHeaders(event, ok(pack));
    }

    if (method === "GET" && path.endsWith("/ng-sec-evidence")) {
      const { from, to } = resolvePeriod(parsedQuery.data);
      const pack = await buildNgSecEvidencePack(user.agencyId, from, to);

      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: user.agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.NG_SEC_EVIDENCE_EXPORTED,
        details: { from, to },
        createdAt: new Date().toISOString(),
        resourceType: "agency",
        resourceId: user.agencyId,
      });

      return withCorrelationHeaders(event, ok(pack));
    }

    if (method === "GET" && path.endsWith("/metrics")) {
      const { from, to } = resolvePeriod(parsedQuery.data);
      const metrics = await buildMetrics(user.agencyId, from, to);

      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: user.agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.NG911_METRICS_VIEWED,
        details: { from, to },
        createdAt: new Date().toISOString(),
        resourceType: "agency",
        resourceId: user.agencyId,
      });

      return withCorrelationHeaders(event, ok(metrics));
    }

    return withCorrelationHeaders(event, notFound("Unknown route"));
  } catch (error) {
    console.error("[ng911.metrics]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
