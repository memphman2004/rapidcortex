import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { postCallerLocationBodySchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { env } from "../lib/env.js";
import { resolveIncidentRead } from "../lib/incidentReadAccess.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../lib/response.js";
import { CallerLocationsRepository } from "../repositories/callerLocationsRepository.js";
import { WebSocketNotificationService } from "../services/websocketNotificationService.js";

const repo = new CallerLocationsRepository();
const ws = new WebSocketNotificationService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.callerLocationsTable) {
      return serviceUnavailable("Caller location tracking is not configured");
    }

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

    const incidentId = event.pathParameters?.incidentId ?? event.pathParameters?.id;
    if (!incidentId) return badRequest("Incident ID required");

    const resolved = await resolveIncidentRead(incidentId, user);
    if (!resolved) return forbidden();
    if (user.role !== "rcsuperadmin" && user.agencyId !== resolved.incident.agencyId) {
      return forbidden();
    }
    const agencyId = resolved.incident.agencyId;

    const method = event.requestContext.http.method.toUpperCase();
    const rawPath = event.rawPath ?? "";

    if (method === "GET" && (rawPath.endsWith("/caller-locations") || event.routeKey?.includes("caller-locations"))) {
      const role = user.role;
      const canRead =
        role === "dispatcher" ||
        role === "supervisor" ||
        role === "agencyadmin" ||
        role === "agencyit" ||
        role === "rcsuperadmin" ||
        role === "rcadmin" ||
        role === "analyst" ||
        role === "auditor";
      if (!canRead) return forbidden();
      const items = await repo.listRecent(incidentId, agencyId, 100);
      return ok({ items });
    }

    if (method === "POST" && (rawPath.endsWith("/caller-location") || event.routeKey?.includes("caller-location"))) {
      let body: unknown = {};
      try {
        body = JSON.parse(event.body ?? "{}");
      } catch {
        return badRequest("Invalid JSON body");
      }
      const parsed = postCallerLocationBodySchema.safeParse(body);
      if (!parsed.success) return badRequestFromZod(parsed.error);

      const entry = await repo.put({ incidentId, agencyId, body: parsed.data });

      try {
        const wsSource =
          entry.source === "cell" ? "CELL_TOWER" : entry.source === "manual" ? "MANUAL" : "GPS";
        await ws.broadcastLocationReceived({
          agencyId,
          incidentId,
          coordinates: {
            latitude: entry.lat,
            longitude: entry.lng,
            accuracy: entry.accuracy,
          },
          source: wsSource,
          receivedAt: entry.timestamp,
          accuracyMeters: entry.accuracy,
        });
      } catch (err) {
        console.warn(
          JSON.stringify({
            type: "caller_location.ws_broadcast_failed",
            incidentId,
            agencyId,
            error: String(err),
          }),
        );
      }

      return ok(entry, 201);
    }

    return notFound();
  } catch (error) {
    console.error(
      JSON.stringify({
        type: "caller_locations.http_error",
        incidentId: event.pathParameters?.incidentId ?? event.pathParameters?.id,
        agencyId: undefined,
        error: String(error),
      }),
    );
    if (error instanceof Error && error.message === "CALLER_LOCATIONS_DISABLED") {
      return serviceUnavailable("Caller location tracking is not configured");
    }
    return serverError();
  }
};
