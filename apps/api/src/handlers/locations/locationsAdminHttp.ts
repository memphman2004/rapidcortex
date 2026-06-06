/**
 * Admin QR location management.
 * /api/admin/tenants/{agencyId}/locations[/{rcli}[/qr]]
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import {
  bulkCreateLocations,
  createLocation,
  deactivateLocation,
  listLocations,
  updateLocation,
} from "../../locations/qr-location-service.js";
import { isRcsuperadmin } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES, AuthorizationService } from "rapid-cortex-security";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";

const auditRepo = new AuditRepository();

function httpMethod(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return (event.requestContext as { http?: { method?: string } }).http?.method ?? "GET";
}

function agencyIdFromEvent(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return event.pathParameters?.agencyId?.trim() ?? "";
}

function rcliFromEvent(event: Parameters<APIGatewayProxyHandlerV2>[0]): string | undefined {
  const raw = event.pathParameters?.rcli?.trim();
  return raw ? raw.toUpperCase() : undefined;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }

    const agencyId = agencyIdFromEvent(event);
    if (!agencyId) return withCorrelationHeaders(event, badRequest("agencyId required"));

    const authz = new AuthorizationService();
    const canManage =
      authz.canAccessAdminRoutes(user) &&
      (isRcsuperadmin(user) || user.agencyId === agencyId);
    if (!canManage) return withCorrelationHeaders(event, forbidden());

    const method = httpMethod(event);
    const rcli = rcliFromEvent(event);
    const isBulk = (event.rawPath ?? "").endsWith("/bulk");

    if (method === "GET" && !rcli) {
      const vertical = event.queryStringParameters?.vertical as "campus" | "venue" | "core" | undefined;
      const activeParam = event.queryStringParameters?.active;
      const active =
        activeParam === undefined ? undefined : activeParam === "true" || activeParam === "1";
      const rows = await listLocations(agencyId, { vertical, active });
      return withCorrelationHeaders(event, ok({ locations: rows }));
    }

    if (method === "POST" && isBulk) {
      let body: unknown;
      try {
        body = JSON.parse(event.body ?? "{}");
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      }
      const payload = body as {
        vertical?: "campus" | "venue" | "core";
        orgCode?: string;
        rows?: unknown[];
      };
      if (!payload.vertical || !payload.orgCode || !Array.isArray(payload.rows)) {
        return withCorrelationHeaders(event, badRequest("vertical, orgCode, and rows are required"));
      }
      const result = await bulkCreateLocations(
        agencyId,
        user.userId,
        payload.vertical,
        payload.orgCode,
        payload.rows,
      );
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.INTEGRATION_STATE,
        details: { action: "qr_locations_bulk_import", created: result.created, errors: result.errors.length },
        createdAt: new Date().toISOString(),
        resourceType: "integration",
      });
      return withCorrelationHeaders(event, ok(result, result.created > 0 ? 201 : 400));
    }

    if (method === "POST" && !rcli) {
      let body: unknown;
      try {
        body = JSON.parse(event.body ?? "{}");
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      }
      const location = await createLocation(agencyId, user.userId, body);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.INTEGRATION_STATE,
        details: { action: "qr_location_created", rcli: location.rcli, zoneCode: location.zoneCode },
        createdAt: new Date().toISOString(),
        resourceType: "integration",
        resourceId: location.rcli,
      });
      return withCorrelationHeaders(event, ok(location, 201));
    }

    if (method === "PUT" && rcli) {
      let body: unknown;
      try {
        body = JSON.parse(event.body ?? "{}");
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      }
      const updated = await updateLocation(agencyId, rcli, body);
      if (!updated) return withCorrelationHeaders(event, notFound("Location not found"));
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.INTEGRATION_STATE,
        details: { action: "qr_location_updated", rcli },
        createdAt: new Date().toISOString(),
        resourceType: "integration",
        resourceId: rcli,
      });
      return withCorrelationHeaders(event, ok(updated));
    }

    if (method === "DELETE" && rcli) {
      const okDelete = await deactivateLocation(agencyId, rcli);
      if (!okDelete) return withCorrelationHeaders(event, notFound("Location not found"));
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.INTEGRATION_STATE,
        details: { action: "qr_location_deactivated", rcli },
        createdAt: new Date().toISOString(),
        resourceType: "integration",
        resourceId: rcli,
      });
      return withCorrelationHeaders(event, ok({ rcli, active: false }));
    }

    return withCorrelationHeaders(event, notFound());
  } catch (error) {
    if (error && typeof error === "object" && "issues" in (error as object)) {
      return withCorrelationHeaders(event, badRequestFromZod(error as never));
    }
    console.error("[locations-admin]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
