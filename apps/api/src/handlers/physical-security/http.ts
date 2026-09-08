import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService, type Permission } from "rapid-cortex-security";
import {
  PHYSICAL_SECURITY_COMMANDS_NOT_IMPLEMENTED,
  physicalSecurityCommandBodySchema,
  physicalSecurityIngestBodySchema,
} from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { verifyPhysicalSecurityWebhookAuth } from "../physical-security/auth.js";
import { getPhysicalSecurityProvider } from "../physical-security/providers.js";
import { ingestPhysicalSecurityEvent, listPhysicalSecurityStatus } from "../physical-security/service.js";

const authz = new AuthorizationService();

function pathOf(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return event.rawPath ?? event.requestContext?.http?.path ?? "";
}

function methodOf(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return (event.requestContext?.http?.method ?? "GET").toUpperCase();
}

function notImplemented() {
  return {
    statusCode: 501,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      error: "Not Implemented",
      reason: PHYSICAL_SECURITY_COMMANDS_NOT_IMPLEMENTED,
    }),
  };
}

function requirePerm(user: { role: string; agencyId: string; userId: string }, perm: Permission) {
  if (!authz.canPerform(user, perm)) {
    throw Object.assign(new Error("FORBIDDEN"), { statusCode: 403 });
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const path = pathOf(event);
    const method = methodOf(event);

    if (method === "POST" && /\/api\/physical-security\/events\/?$/.test(path)) {
      if (!env.enablePhysicalSecurityIngest) {
        return withCorrelationHeaders(event, notFound());
      }
      const rawBody = event.body ?? "{}";
      const auth = verifyPhysicalSecurityWebhookAuth(event, rawBody);
      if (!auth.ok) {
        if (auth.reason === "webhook_secret_not_configured") {
          return withCorrelationHeaders(event, {
            statusCode: 503,
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ error: "Physical security webhook secret is not configured" }),
          });
        }
        return withCorrelationHeaders(event, unauthorized("Invalid physical security webhook signature"));
      }
      let json: unknown;
      try {
        json = JSON.parse(rawBody);
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      }
      const parsed = physicalSecurityIngestBodySchema.safeParse(json);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const result = await ingestPhysicalSecurityEvent(parsed.data);
      return withCorrelationHeaders(
        event,
        ok({
          eventId: result.event.eventId,
          incidentId: result.incidentId,
          correlatedIncidentIds: result.event.correlatedIncidentIds,
          mapBadge: result.event.mapBadge,
        }),
      );
    }

    if (
      method === "POST" &&
      (/\/api\/physical-security\/commands\/?$/.test(path) ||
        /\/api\/physical-security\/commands\/propose\/?$/.test(path))
    ) {
      return withCorrelationHeaders(event, notImplemented());
    }

    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }
    const agencyId = user.agencyId ?? "";
    if (!agencyId) return withCorrelationHeaders(event, forbidden("agencyId required"));

    if (method === "GET" && /\/api\/physical-security\/status\/?$/.test(path)) {
      requirePerm(user, "physical.event.view");
      const payload = await listPhysicalSecurityStatus(agencyId);
      return withCorrelationHeaders(event, ok(payload));
    }

    if (method === "GET" && /\/api\/physical-security\/access-history/.test(path)) {
      return withCorrelationHeaders(event, notImplemented());
    }

    if (method === "POST" && /\/api\/physical-security\/commands/.test(path)) {
      physicalSecurityCommandBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      void getPhysicalSecurityProvider("mock");
      return withCorrelationHeaders(event, notImplemented());
    }

    return withCorrelationHeaders(event, notFound());
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 403 || (error as Error).message === "FORBIDDEN") {
      return withCorrelationHeaders(event, forbidden());
    }
    if ((error as { statusCode?: number }).statusCode === 404) {
      return withCorrelationHeaders(event, notFound());
    }
    if ((error as { statusCode?: number }).statusCode === 501) {
      return withCorrelationHeaders(event, notImplemented());
    }
    console.error("[physical-security]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
