import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { ringRequestCameraAccessBodySchema } from "rapid-cortex-shared";
import { isRingEmergencyRequestsEnabled, RingDeviceService } from "../../lib/ring-integration.js";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { env } from "../../lib/env.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { AgencyRepository } from "../../repositories/agencyRepository.js";
import {
  agencyIncidentKey,
  RingEmergencyRepository,
} from "../../repositories/ringEmergencyRepository.js";
import { notifyRingAccountOwner } from "../../services/ringOwnerNotificationService.js";
import { isRingAuthorizedRole } from "./ring-auth.js";
import { auditRingEvent, AUDIT_EVENT_TYPES } from "./ring-audit.js";
import { ringJson } from "./ring-api-response.js";
import { incidentCoordinates, requireActiveRingIncident } from "./ring-incident.js";
import { configureRingEmergencyTables } from "./ring-tables.js";

const BCRYPT_ROUNDS = 12;
const deviceService = new RingDeviceService();
const emergencyRepo = new RingEmergencyRepository();
const agencyRepo = new AgencyRepository();

function consentBaseUrl(): string {
  return env.ringPublicApiBaseUrl.replace(/\/$/, "");
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
    if (!isRingEmergencyRequestsEnabled()) {
      return ringJson({ success: false, error: "Ring emergency requests are not enabled." }, 403);
    }
    if (!isRingAuthorizedRole(user)) {
      return ringJson({ success: false, error: "Forbidden" }, 403);
    }

    let body: unknown;
    try {
      body = JSON.parse(event.body ?? "{}");
    } catch {
      return ringJson({ success: false, error: "Invalid request body." }, 400);
    }

    const parsed = ringRequestCameraAccessBodySchema.safeParse(body);
    if (!parsed.success) {
      return ringJson({ success: false, error: "Invalid request body." }, 400);
    }

    const { incidentId, deviceId, requestedDurationMinutes } = parsed.data;
    const incidentResult = await requireActiveRingIncident(incidentId, user);
    if (!incidentResult.ok) {
      return ringJson({ success: false, error: incidentResult.message }, incidentResult.statusCode);
    }

    const device = await deviceService.getDeviceByAgencyAndDeviceId(user.agencyId, deviceId);
    if (!device) {
      return ringJson({ success: false, error: "Device not found." }, 404);
    }
    if (device.agencyId !== user.agencyId) {
      return ringJson({ success: false, error: "Forbidden" }, 403);
    }
    if (!device.isEnabledForConnect) {
      return ringJson({ success: false, error: "Device is not enabled for Connect." }, 400);
    }

    const duplicate = await emergencyRepo.findActiveRequestForDevice(
      user.agencyId,
      incidentId,
      deviceId,
    );
    if (duplicate) {
      return ringJson(
        { success: false, error: "An active request already exists for this camera." },
        409,
      );
    }

    const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentCount = await emergencyRepo.countRequestsSince(user.agencyId, incidentId, sinceIso);
    if (recentCount >= 5) {
      return ringJson(
        { success: false, error: "Request limit reached for this incident." },
        429,
      );
    }

    const { latitude, longitude } = incidentCoordinates(incidentResult.incident);
    const requestId = randomUUID();
    const plainToken = randomBytes(32).toString("hex");
    const requestTokenHash = await bcrypt.hash(plainToken, BCRYPT_ROUNDS);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + (requestedDurationMinutes + 30) * 60 * 1000,
    ).toISOString();
    const expiresAtTtl = Math.floor(new Date(expiresAt).getTime() / 1000);

    const nearby = await deviceService.getDevicesNearIncident(
      user.agencyId,
      latitude,
      longitude,
      2000,
    );
    const match = nearby.find((d) => d.deviceId === deviceId);
    const distanceMeters = match?.distanceMeters ?? 0;

    const agency = await agencyRepo.get(user.agencyId);
    const agencyName = agency?.name ?? user.agencyId;

    const base = consentBaseUrl();
    const approveUrl = `${base}/api/integrations/ring/consent/${plainToken}/approve`;
    const declineUrl = `${base}/api/integrations/ring/consent/${plainToken}/decline`;

    const record = {
      requestId,
      agencyId: user.agencyId,
      jurisdictionId: user.agencyId,
      incidentId,
      requestedByUserId: user.userId,
      ringAccountId: device.ringAccountId,
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      deviceType: device.deviceType,
      incidentLatitude: latitude,
      incidentLongitude: longitude,
      deviceLatitude: device.latitude ?? latitude,
      deviceLongitude: device.longitude ?? longitude,
      distanceMeters,
      requestStatus: "DRAFT" as const,
      requestedDurationMinutes,
      approvedDurationMinutes: null,
      requestTokenHash,
      createdAt: now.toISOString(),
      expiresAt,
      approvedAt: null,
      declinedAt: null,
      revokedAt: null,
      usedAt: null,
      agencyIncidentKey: agencyIncidentKey(user.agencyId, incidentId),
      expiresAtTtl,
    };

    await emergencyRepo.putRequest(record);

    await auditRingEvent({
      type: AUDIT_EVENT_TYPES.RING_CAMERA_REQUEST_CREATED,
      agencyId: user.agencyId,
      actorId: user.userId,
      details: { incidentId, deviceId, requestId, requestedDurationMinutes },
      resourceId: requestId,
    });

    const notification = await notifyRingAccountOwner({
      ownerUserId: device.userId,
      agencyId: user.agencyId,
      agencyName,
      incidentId,
      incidentCategoryLabel: incidentResult.incident.category,
      requestedDurationMinutes,
      approveUrl,
      declineUrl,
    });

    if (!notification.delivered) {
      await emergencyRepo.updateRequest(user.agencyId, incidentId, requestId, {
        requestStatus: "DRAFT",
      });
      console.error(
        JSON.stringify({
          msg: "ring_camera_request_notification_failed",
          agencyId: user.agencyId,
          incidentId,
          requestId,
        }),
      );
      return ringJson(
        {
          success: true,
          data: { requestId, requestStatus: "DRAFT", expiresAt },
          error: "Notification could not be delivered.",
        },
        202,
      );
    }

    await emergencyRepo.updateRequest(user.agencyId, incidentId, requestId, {
      requestStatus: "SENT",
    });

    await auditRingEvent({
      type: AUDIT_EVENT_TYPES.RING_CAMERA_REQUEST_SENT,
      agencyId: user.agencyId,
      actorId: user.userId,
      details: { incidentId, deviceId, requestId, requestedDurationMinutes },
      resourceId: requestId,
    });

    return ringJson(
      {
        success: true,
        data: { requestId, requestStatus: "SENT", expiresAt },
      },
      201,
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_request_camera_access_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringJson({ success: false, error: "Unable to request Ring camera access." }, 500);
  }
};
