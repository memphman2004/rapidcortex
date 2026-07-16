import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  lostModePayloadSchema,
  patchDevicePayloadSchema,
  postDeviceLocationPayloadSchema,
  rcCoreConsentPayloadSchema,
  registerDevicePayloadSchema,
} from "rapid-cortex-shared";
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
  deleteDevice,
  getDevice,
  getDeviceLocation,
  listDevices,
  listLocationHistory,
  putDevice,
  putDeviceLocation,
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
    const agencyId = user.agencyId;

    if (method === "GET" && path === "/api/safe-sound/devices") {
      const devices = await listDevices(agencyId, user.userId);
      return mobileOk(event, { devices });
    }

    if (method === "POST" && path === "/api/safe-sound/devices/register") {
      const body = parseJsonBody(event);
      if (body === null) return mobileError(event, badRequest("Invalid JSON"));
      const parsed = registerDevicePayloadSchema.safeParse(body);
      if (!parsed.success) return mobileError(event, badRequestFromZod(parsed.error));

      const now = new Date().toISOString();
      const device = {
        deviceId: parsed.data.deviceId,
        ownerId: user.userId,
        name: parsed.data.name,
        type: parsed.data.type,
        mountType: parsed.data.mountType,
        bleAddress: parsed.data.bleAddress ?? null,
        serialNumber: parsed.data.serialNumber ?? null,
        status: "offline" as const,
        lostModeActive: false,
        lastSeenAt: null,
        batteryPct: null,
        rcCoreConsent: false,
        createdAt: now,
        updatedAt: now,
      };
      await putDevice(agencyId, device);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SAFE_SOUND_DEVICE_REGISTERED,
        details: { deviceId: device.deviceId, type: device.type },
        createdAt: now,
        resourceType: "integration",
        resourceId: device.deviceId,
      });
      return mobileOk(event, { device }, 201);
    }

    if (!deviceId) return mobileError(event, notFound());

    if (method === "GET" && path === `/api/safe-sound/devices/${deviceId}`) {
      const row = await getDevice(agencyId, deviceId);
      if (!row) return mobileError(event, notFound("Device not found"));
      const ownerGate = assertDeviceOwner(user, row.ownerId);
      if (ownerGate) return mobileError(event, ownerGate);
      const { agencyId: _a, ...device } = row;
      return mobileOk(event, { device });
    }

    if (method === "PATCH" && path === `/api/safe-sound/devices/${deviceId}`) {
      const row = await getDevice(agencyId, deviceId);
      if (!row) return mobileError(event, notFound("Device not found"));
      const ownerGate = assertDeviceOwner(user, row.ownerId);
      if (ownerGate) return mobileError(event, ownerGate);

      const body = parseJsonBody(event);
      if (body === null) return mobileError(event, badRequest("Invalid JSON"));
      const parsed = patchDevicePayloadSchema.safeParse(body);
      if (!parsed.success) return mobileError(event, badRequestFromZod(parsed.error));

      const now = new Date().toISOString();
      const { agencyId: _a, ...existing } = row;
      const device = {
        ...existing,
        ...parsed.data,
        updatedAt: now,
      };
      await putDevice(agencyId, device);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SAFE_SOUND_DEVICE_UPDATED,
        details: { deviceId, patch: parsed.data },
        createdAt: now,
        resourceType: "integration",
        resourceId: deviceId,
      });
      return mobileOk(event, { device });
    }

    if (method === "DELETE" && path === `/api/safe-sound/devices/${deviceId}`) {
      const row = await getDevice(agencyId, deviceId);
      if (!row) return mobileError(event, notFound("Device not found"));
      const ownerGate = assertDeviceOwner(user, row.ownerId);
      if (ownerGate) return mobileError(event, ownerGate);

      await deleteDevice(agencyId, deviceId);
      const now = new Date().toISOString();
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SAFE_SOUND_DEVICE_DELETED,
        details: { deviceId },
        createdAt: now,
        resourceType: "integration",
        resourceId: deviceId,
      });
      return mobileOk(event, { success: true });
    }

    if (path.endsWith("/location")) {
      if (method === "GET") {
        const row = await getDevice(agencyId, deviceId);
        if (!row) return mobileError(event, notFound("Device not found"));
        const ownerGate = assertDeviceOwner(user, row.ownerId);
        if (ownerGate) return mobileError(event, ownerGate);
        const location = await getDeviceLocation(agencyId, deviceId);
        if (!location) return mobileError(event, notFound("Location not available"));
        return mobileOk(event, { location });
      }

      if (method === "POST") {
        const row = await getDevice(agencyId, deviceId);
        if (!row) return mobileError(event, notFound("Device not found"));
        const ownerGate = assertDeviceOwner(user, row.ownerId);
        if (ownerGate) return mobileError(event, ownerGate);

        const body = parseJsonBody(event);
        if (body === null) return mobileError(event, badRequest("Invalid JSON"));
        const parsed = postDeviceLocationPayloadSchema.safeParse(body);
        if (!parsed.success) return mobileError(event, badRequestFromZod(parsed.error));

        const location = await putDeviceLocation(agencyId, deviceId, parsed.data);
        const now = new Date().toISOString();
        await putDevice(agencyId, {
          ...row,
          lastSeenAt: parsed.data.timestamp,
          status: "online",
          updatedAt: now,
        });
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.SAFE_SOUND_LOCATION_RECORDED,
          details: { deviceId, source: parsed.data.source },
          createdAt: now,
          resourceType: "integration",
          resourceId: deviceId,
        });
        return mobileOk(event, { location });
      }
    }

    if (method === "GET" && path.endsWith("/history")) {
      const row = await getDevice(agencyId, deviceId);
      if (!row) return mobileError(event, notFound("Device not found"));
      const ownerGate = assertDeviceOwner(user, row.ownerId);
      if (ownerGate) return mobileError(event, ownerGate);

      const limit = Math.min(
        200,
        Number.parseInt(event.queryStringParameters?.limit ?? "50", 10) || 50,
      );
      const events = await listLocationHistory(agencyId, deviceId, limit);
      return mobileOk(event, { events });
    }

    if (method === "POST" && path.endsWith("/lost-mode")) {
      const row = await getDevice(agencyId, deviceId);
      if (!row) return mobileError(event, notFound("Device not found"));
      const ownerGate = assertDeviceOwner(user, row.ownerId);
      if (ownerGate) return mobileError(event, ownerGate);

      const body = parseJsonBody(event);
      if (body === null) return mobileError(event, badRequest("Invalid JSON"));
      const parsed = lostModePayloadSchema.safeParse(body);
      if (!parsed.success) return mobileError(event, badRequestFromZod(parsed.error));

      const now = new Date().toISOString();
      const { agencyId: _a, ...existing } = row;
      const device = {
        ...existing,
        lostModeActive: parsed.data.active,
        status: parsed.data.active ? ("lost" as const) : existing.status,
        updatedAt: now,
      };
      await putDevice(agencyId, device);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SAFE_SOUND_LOST_MODE_TOGGLED,
        details: { deviceId, active: parsed.data.active },
        createdAt: now,
        resourceType: "integration",
        resourceId: deviceId,
      });
      return mobileOk(event, { device });
    }

    if (method === "PUT" && path.endsWith("/rc-core-consent")) {
      const row = await getDevice(agencyId, deviceId);
      if (!row) return mobileError(event, notFound("Device not found"));
      const ownerGate = assertDeviceOwner(user, row.ownerId);
      if (ownerGate) return mobileError(event, ownerGate);

      const body = parseJsonBody(event);
      if (body === null) return mobileError(event, badRequest("Invalid JSON"));
      const parsed = rcCoreConsentPayloadSchema.safeParse(body);
      if (!parsed.success) return mobileError(event, badRequestFromZod(parsed.error));

      const now = new Date().toISOString();
      const { agencyId: _a, ...existing } = row;
      const device = {
        ...existing,
        rcCoreConsent: parsed.data.consent,
        updatedAt: now,
      };
      await putDevice(agencyId, device);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SAFE_SOUND_RC_CORE_CONSENT_UPDATED,
        details: { deviceId, consent: parsed.data.consent },
        createdAt: now,
        resourceType: "integration",
        resourceId: deviceId,
      });
      return mobileOk(event, { device });
    }

    return mobileError(event, notFound());
  } catch (e) {
    console.error("safe-sound devicesHttp", e);
    return mobileError(event, serverError());
  }
};
