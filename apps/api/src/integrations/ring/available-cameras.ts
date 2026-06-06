import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import type { RingCameraListItem } from "../../lib/ring-integration.js";
import { isRingAvailableCamerasEnabled, RingDeviceService } from "../../lib/ring-integration.js";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { RingEmergencyRepository } from "../../repositories/ringEmergencyRepository.js";
import { isRingAuthorizedRole } from "./ring-auth.js";
import { auditRingEvent, AUDIT_EVENT_TYPES } from "./ring-audit.js";
import { ringJson } from "./ring-api-response.js";
import { incidentCoordinates, requireActiveRingIncident } from "./ring-incident.js";
import { configureRingEmergencyTables } from "./ring-tables.js";

const devices = new RingDeviceService();
const requests = new RingEmergencyRepository();

function roundDistanceMeters(distanceMeters: number): number {
  return Math.floor(distanceMeters / 10) * 10;
}

function parseRadiusMeters(raw: string | undefined): number {
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  const value = Number.isFinite(parsed) ? parsed : 500;
  return Math.min(2000, Math.max(100, value));
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    configureRingEmergencyTables();

    const user = await getUserContext(event);
    if (!user) return ringJson({ success: false, error: "Unauthorized" }, 401);
    if (!isUserAccountActive(user)) {
      return ringJson({ success: false, error: ACCOUNT_INACTIVE_MESSAGE }, 403);
    }
    const pwd = operationalPasswordBlock(user);
    if (pwd) {
      return ringJson({ success: false, error: "Password update is required before continuing." }, 403);
    }
    if (!isRingAvailableCamerasEnabled()) {
      return ringJson({ success: false, error: "Ring available cameras is not enabled." }, 403);
    }
    if (!isRingAuthorizedRole(user)) {
      return ringJson({ success: false, error: "Forbidden" }, 403);
    }

    const incidentId = event.queryStringParameters?.incidentId?.trim() ?? "";
    if (!incidentId) {
      return ringJson({ success: false, error: "incidentId is required." }, 400);
    }

    const incidentResult = await requireActiveRingIncident(incidentId, user);
    if (!incidentResult.ok) {
      return ringJson({ success: false, error: incidentResult.message }, incidentResult.statusCode);
    }

    const radiusMeters = parseRadiusMeters(event.queryStringParameters?.radiusMeters);
    const { latitude, longitude } = incidentCoordinates(incidentResult.incident);
    const nearby = await devices.getDevicesNearIncident(
      user.agencyId,
      latitude,
      longitude,
      radiusMeters,
    );

    const incidentRequests = await requests.listRequestsForIncident(user.agencyId, incidentId);
    const latestByDevice = new Map<string, (typeof incidentRequests)[number]>();
    for (const row of incidentRequests) {
      const prev = latestByDevice.get(row.deviceId);
      if (!prev || row.createdAt > prev.createdAt) latestByDevice.set(row.deviceId, row);
    }

    const cameras: RingCameraListItem[] = nearby.map((device) => {
      const latest = latestByDevice.get(device.deviceId);
      const ownerStatus = latest?.requestStatus ?? "AVAILABLE";
      return {
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        deviceType: device.deviceType,
        distanceMeters: roundDistanceMeters(device.distanceMeters),
        ownerStatus,
      };
    });

    await auditRingEvent({
      type: AUDIT_EVENT_TYPES.AVAILABLE_RING_CAMERAS_VIEWED,
      agencyId: user.agencyId,
      actorId: user.userId,
      details: { incidentId, cameraCount: cameras.length, radiusMeters },
    });

    return ringJson({
      success: true,
      data: { incidentId, radiusMeters, cameras },
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_available_cameras_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringJson({ success: false, error: "Unable to list available Ring cameras." }, 500);
  }
};
