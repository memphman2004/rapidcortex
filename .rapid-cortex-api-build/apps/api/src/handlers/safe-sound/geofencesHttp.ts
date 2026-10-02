import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { createGeofencePayloadSchema } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  badRequest,
  badRequestFromZod,
  notFound,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import {
  assertDeviceOwner,
  gateSafeSound,
  httpMethod,
  mobileError,
  mobileOk,
  parseJsonBody,
} from "./shared.js";
import {
  deleteGeofence,
  getDevice,
  getGeofence,
  listGeofences,
  putGeofence,
} from "./store.js";

const auditRepo = new AuditRepository();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const gate = gateSafeSound(event);
    if (gate) return gate;

    const user = await getUserContext(event);
    if (!user) return mobileError(event, unauthorized());
    if (!isUserAccountActive(user)) return mobileError(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));

    const method = httpMethod(event);
    const path = event.rawPath ?? "";
    const deviceId = event.pathParameters?.deviceId?.trim();
    const geofenceId = event.pathParameters?.geofenceId?.trim();
    const agencyId = user.agencyId;

    if (deviceId && path.endsWith("/geofences")) {
      const row = await getDevice(agencyId, deviceId);
      if (!row) return mobileError(event, notFound("Device not found"));
      const ownerGate = assertDeviceOwner(user, row.ownerId);
      if (ownerGate) return mobileError(event, ownerGate);

      if (method === "GET") {
        const geofences = await listGeofences(agencyId, deviceId);
        return mobileOk(event, { geofences });
      }

      if (method === "POST") {
        const body = parseJsonBody(event);
        if (body === null) return mobileError(event, badRequest("Invalid JSON"));
        const parsed = createGeofencePayloadSchema.safeParse(body);
        if (!parsed.success) return mobileError(event, badRequestFromZod(parsed.error));

        const now = new Date().toISOString();
        const geofence = {
          geofenceId: makeId("gf"),
          deviceId,
          name: parsed.data.name,
          shape: parsed.data.shape,
          centerLat: parsed.data.centerLat ?? null,
          centerLng: parsed.data.centerLng ?? null,
          radiusMeters: parsed.data.radiusMeters ?? null,
          polygonCoordinates: parsed.data.polygonCoordinates ?? null,
          alertOnEnter: parsed.data.alertOnEnter,
          alertOnExit: parsed.data.alertOnExit,
          schedule: parsed.data.schedule ?? null,
          active: true,
          createdAt: now,
          updatedAt: now,
        };
        await putGeofence(agencyId, geofence);
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.SAFE_SOUND_GEOFENCE_CREATED,
          details: { deviceId, geofenceId: geofence.geofenceId, name: geofence.name },
          createdAt: now,
          resourceType: "integration",
          resourceId: geofence.geofenceId,
        });
        return mobileOk(event, { geofence }, 201);
      }
    }

    if (geofenceId && method === "DELETE" && path.includes("/api/safe-sound/geofences/")) {
      const row = await getGeofence(agencyId, geofenceId);
      if (!row) return mobileError(event, notFound("Geofence not found"));

      const device = await getDevice(agencyId, row.deviceId);
      if (!device) return mobileError(event, notFound("Device not found"));
      const ownerGate = assertDeviceOwner(user, device.ownerId);
      if (ownerGate) return mobileError(event, ownerGate);

      await deleteGeofence(agencyId, geofenceId);
      const now = new Date().toISOString();
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SAFE_SOUND_GEOFENCE_DELETED,
        details: { geofenceId, deviceId: row.deviceId },
        createdAt: now,
        resourceType: "integration",
        resourceId: geofenceId,
      });
      return mobileOk(event, { success: true });
    }

    return mobileError(event, notFound());
  } catch (e) {
    console.error("safe-sound geofencesHttp", e);
    return mobileError(event, serverError());
  }
};
