/**
 * Milestone XProtect HTTP router — cloud adapter to on-prem Bridge Protocol.
 * Routes: connect, disconnect, status, cameras/sync, cameras/near, live, events, alarms.
 */

import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  canAdminVision,
  canRequestVisionAccess,
  canViewVision,
  milestoneAlarmBodySchema,
  milestoneConnectBodySchema,
  milestoneEventBodySchema,
  milestoneLiveTicketBodySchema,
  milestoneNearCamerasQuerySchema,
} from "rapid-cortex-shared";
import {
  ACCOUNT_INACTIVE_MESSAGE,
  getUserContext,
  isUserAccountActive,
} from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import {
  connectMilestone,
  disconnectMilestone,
  getMilestoneStatus,
  listMilestoneCamerasNear,
  requestMilestoneLiveTicket,
  sendMilestoneAlarm,
  sendMilestoneEvent,
  syncMilestoneCameras,
} from "../../integrations/milestone/milestone-service.js";
import { getCampusIncident } from "../../campus/campus-incident-service.js";

function pathOf(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return event.rawPath ?? event.requestContext?.http?.path ?? "";
}

function methodOf(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return (event.requestContext?.http?.method ?? "GET").toUpperCase();
}

function statusFromError(err: unknown): number | undefined {
  if (err && typeof err === "object" && "statusCode" in err) {
    const n = Number((err as { statusCode?: number }).statusCode);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

async function parseJson(event: Parameters<APIGatewayProxyHandlerV2>[0]): Promise<unknown> {
  const raw = event.body ?? "{}";
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("Invalid JSON"), { statusCode: 400 });
  }
}

function incidentOrigin(incident: {
  locationData?: Array<{
    coordinates?: { latitude: number; longitude: number };
  }>;
}): { latitude: number; longitude: number } | null {
  const entries = incident.locationData ?? [];
  const last = entries[entries.length - 1];
  if (
    last?.coordinates &&
    Number.isFinite(last.coordinates.latitude) &&
    Number.isFinite(last.coordinates.longitude)
  ) {
    return {
      latitude: last.coordinates.latitude,
      longitude: last.coordinates.longitude,
    };
  }
  return null;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableMilestoneXprotect) {
      return withCorrelationHeaders(event, notFound());
    }

    const path = pathOf(event);
    const method = methodOf(event);

    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!(await isUserAccountActive(user))) {
      return withCorrelationHeaders(event, forbidden(ACCOUNT_INACTIVE_MESSAGE));
    }
    const agencyId = user.agencyId?.trim();
    if (!agencyId) return withCorrelationHeaders(event, forbidden("Agency context required"));

    if (method === "GET" && /\/api\/milestone\/status\/?$/.test(path)) {
      if (!canViewVision(user, agencyId)) {
        return withCorrelationHeaders(event, forbidden());
      }
      const status = await getMilestoneStatus(agencyId);
      return withCorrelationHeaders(event, ok(status));
    }

    if (method === "POST" && /\/api\/milestone\/connect\/?$/.test(path)) {
      if (!canAdminVision(user, agencyId)) {
        return withCorrelationHeaders(event, forbidden());
      }
      const parsed = milestoneConnectBodySchema.safeParse(await parseJson(event));
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const status = await connectMilestone(agencyId, parsed.data, user.userId);
      return withCorrelationHeaders(event, ok(status, 201));
    }

    if (method === "DELETE" && /\/api\/milestone\/(disconnect|connect)\/?$/.test(path)) {
      if (!canAdminVision(user, agencyId)) {
        return withCorrelationHeaders(event, forbidden());
      }
      await disconnectMilestone(agencyId, user.userId);
      return withCorrelationHeaders(event, ok({ disconnected: true }));
    }

    if (method === "POST" && /\/api\/milestone\/cameras\/sync\/?$/.test(path)) {
      if (!canAdminVision(user, agencyId)) {
        return withCorrelationHeaders(event, forbidden());
      }
      const result = await syncMilestoneCameras(agencyId, user.userId);
      return withCorrelationHeaders(event, ok(result));
    }

    if (method === "GET" && /\/api\/milestone\/cameras\/near\/?$/.test(path)) {
      if (!canRequestVisionAccess(user, agencyId)) {
        return withCorrelationHeaders(event, forbidden());
      }
      const parsed = milestoneNearCamerasQuerySchema.safeParse(event.queryStringParameters ?? {});
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));

      let origin: { latitude: number; longitude: number } | null = null;
      if (parsed.data.latitude != null && parsed.data.longitude != null) {
        origin = { latitude: parsed.data.latitude, longitude: parsed.data.longitude };
      } else if (parsed.data.campusCode) {
        try {
          const incident = await getCampusIncident(parsed.data.campusCode, parsed.data.incidentId);
          if (incident) origin = incidentOrigin(incident);
        } catch {
          origin = null;
        }
      }
      if (!origin) {
        return withCorrelationHeaders(
          event,
          badRequest("Provide latitude/longitude or campusCode with an incident that has GPS"),
        );
      }
      const cameras = await listMilestoneCamerasNear(
        agencyId,
        origin,
        parsed.data.radiusMeters,
        parsed.data.limit,
      );
      return withCorrelationHeaders(
        event,
        ok({ cameras, origin, radiusMeters: parsed.data.radiusMeters, incidentId: parsed.data.incidentId }),
      );
    }

    const liveMatch = path.match(/\/api\/milestone\/cameras\/([^/]+)\/live\/?$/);
    if (method === "POST" && liveMatch) {
      if (!canRequestVisionAccess(user, agencyId)) {
        return withCorrelationHeaders(event, forbidden());
      }
      const cameraId = decodeURIComponent(liveMatch[1] ?? "");
      const parsed = milestoneLiveTicketBodySchema.safeParse(await parseJson(event));
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const ticket = await requestMilestoneLiveTicket(agencyId, cameraId, parsed.data, user.userId);
      return withCorrelationHeaders(event, ok(ticket));
    }

    if (method === "POST" && /\/api\/milestone\/events\/?$/.test(path)) {
      if (!canRequestVisionAccess(user, agencyId)) {
        return withCorrelationHeaders(event, forbidden());
      }
      const parsed = milestoneEventBodySchema.safeParse(await parseJson(event));
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const ack = await sendMilestoneEvent(agencyId, parsed.data, user.userId);
      return withCorrelationHeaders(event, ok(ack));
    }

    if (method === "POST" && /\/api\/milestone\/alarms\/?$/.test(path)) {
      if (!canRequestVisionAccess(user, agencyId)) {
        return withCorrelationHeaders(event, forbidden());
      }
      const parsed = milestoneAlarmBodySchema.safeParse(await parseJson(event));
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const ack = await sendMilestoneAlarm(agencyId, parsed.data, user.userId);
      return withCorrelationHeaders(event, ok(ack));
    }

    return withCorrelationHeaders(event, notFound());
  } catch (error) {
    const code = statusFromError(error);
    if (code === 400) {
      return withCorrelationHeaders(
        event,
        badRequest(error instanceof Error ? error.message : "Bad request"),
      );
    }
    if (code === 403) return withCorrelationHeaders(event, forbidden());
    if (code === 503) {
      return withCorrelationHeaders(
        event,
        serviceUnavailable(error instanceof Error ? error.message : "Unavailable"),
      );
    }
    console.error("[milestone-http]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
