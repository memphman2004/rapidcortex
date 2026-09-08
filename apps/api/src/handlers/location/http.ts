import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService, AUDIT_EVENT_TYPES, type Permission } from "rapid-cortex-security";
import {
  alsDevicePositionBodySchema,
  alsGeocodeQuerySchema,
  alsGeofenceUpsertBodySchema,
  alsReverseGeocodeQuerySchema,
  alsRouteQuerySchema,
} from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
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
import { AuditRepository } from "../../repositories/auditRepository.js";
import { geocodeAddress, reverseGeocode } from "../../location/geocoding.js";
import { calculateRoute } from "../../location/routing.js";
import { deleteZoneGeofence, upsertZoneGeofence } from "../../location/geofence.js";
import { getAgencyDevicePositions, updateDevicePosition } from "../../location/tracker.js";

const authz = new AuthorizationService();
const auditRepo = new AuditRepository();

const GEOCODE_PERMS: Permission[] = [
  "incidents.view",
  "incidents.create",
  "locations.qrcodes.view",
  "locations.qrcodes.manage",
];

function pathOf(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return event.rawPath ?? event.requestContext?.http?.path ?? "";
}

function methodOf(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return (event.requestContext?.http?.method ?? "GET").toUpperCase();
}

function queryOf(event: Parameters<APIGatewayProxyHandlerV2>[0]): Record<string, string> {
  const raw = event.queryStringParameters ?? {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function canGeocode(user: { role: string; agencyId: string; userId: string }): boolean {
  return GEOCODE_PERMS.some((perm) => authz.canPerform(user, perm));
}

function requirePerm(user: { role: string; agencyId: string; userId: string }, perm: Permission) {
  if (!authz.canPerform(user, perm)) {
    throw Object.assign(new Error("FORBIDDEN"), { statusCode: 403 });
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, forbidden(ACCOUNT_INACTIVE_MESSAGE));
    }

    const path = pathOf(event);
    const method = methodOf(event);
    const qs = queryOf(event);

    if (method === "GET" && /\/api\/location\/geocode\/?$/.test(path)) {
      if (!canGeocode(user)) return withCorrelationHeaders(event, forbidden());
      const parsed = alsGeocodeQuerySchema.safeParse(qs);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const results = await geocodeAddress(parsed.data.address, {
        biasLat: parsed.data.lat,
        biasLng: parsed.data.lng,
      });
      return withCorrelationHeaders(event, ok({ results }));
    }

    if (method === "GET" && /\/api\/location\/reverse\/?$/.test(path)) {
      if (!canGeocode(user)) return withCorrelationHeaders(event, forbidden());
      const parsed = alsReverseGeocodeQuerySchema.safeParse(qs);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const results = await reverseGeocode(parsed.data.lng, parsed.data.lat);
      return withCorrelationHeaders(event, ok({ results }));
    }

    if (method === "GET" && /\/api\/location\/route\/?$/.test(path)) {
      if (!canGeocode(user)) return withCorrelationHeaders(event, forbidden());
      const parsed = alsRouteQuerySchema.safeParse(qs);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const result = await calculateRoute(
        [parsed.data.fromLng, parsed.data.fromLat],
        [parsed.data.toLng, parsed.data.toLat],
      );
      return withCorrelationHeaders(event, ok(result));
    }

    if (method === "POST" && /\/api\/location\/geofences\/?$/.test(path)) {
      requirePerm(user, "locations.qrcodes.manage");
      let json: unknown;
      try {
        json = JSON.parse(event.body ?? "{}");
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      }
      const parsed = alsGeofenceUpsertBodySchema.safeParse(json);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const result = await upsertZoneGeofence(user.agencyId, parsed.data.zoneId, parsed.data.polygon);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: user.agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.LOCATION_GEOFENCE_UPSERTED,
        details: { zoneId: parsed.data.zoneId, geofenceId: result.geofenceId, mocked: result.mocked },
        createdAt: new Date().toISOString(),
        resourceType: "agency",
        resourceId: parsed.data.zoneId,
      });
      return withCorrelationHeaders(event, ok(result));
    }

    if (method === "DELETE" && /\/api\/location\/geofences\/([^/]+)\/?$/.test(path)) {
      requirePerm(user, "locations.qrcodes.manage");
      const zoneId = decodeURIComponent(path.match(/\/geofences\/([^/]+)\/?$/)?.[1] ?? "");
      if (!zoneId) return withCorrelationHeaders(event, badRequest("zoneId required"));
      const result = await deleteZoneGeofence(user.agencyId, zoneId);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: user.agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.LOCATION_GEOFENCE_DELETED,
        details: { zoneId, geofenceId: result.geofenceId, mocked: result.mocked },
        createdAt: new Date().toISOString(),
        resourceType: "agency",
        resourceId: zoneId,
      });
      return withCorrelationHeaders(event, ok(result));
    }

    if (method === "POST" && /\/api\/location\/devices\/position\/?$/.test(path)) {
      if (!canGeocode(user)) return withCorrelationHeaders(event, forbidden());
      let json: unknown;
      try {
        json = JSON.parse(event.body ?? "{}");
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      }
      const parsed = alsDevicePositionBodySchema.safeParse(json);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const result = await updateDevicePosition(
        user.agencyId,
        user.userId,
        parsed.data.longitude,
        parsed.data.latitude,
      );
      return withCorrelationHeaders(event, ok(result));
    }

    if (method === "GET" && /\/api\/location\/devices\/?$/.test(path)) {
      if (!canGeocode(user)) return withCorrelationHeaders(event, forbidden());
      const entries = await getAgencyDevicePositions(user.agencyId);
      return withCorrelationHeaders(event, ok({ entries }));
    }

    return withCorrelationHeaders(event, notFound());
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 403) return withCorrelationHeaders(event, forbidden());
    return withCorrelationHeaders(event, serverError());
  }
};
