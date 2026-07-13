import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { isRingEnabled, RingDeviceService } from "../../lib/ring-integration.js";
import type { LinkedRingDevice } from "../../lib/ring-integration.js";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { env } from "../../lib/env.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { auditRingEvent, AUDIT_EVENT_TYPES } from "./ring-audit.js";
import { ringJson } from "./ring-api-response.js";

export type PublicRingDevice = Pick<
  LinkedRingDevice,
  | "deviceId"
  | "deviceName"
  | "deviceType"
  | "locationLabel"
  | "latitude"
  | "longitude"
  | "isEnabledForConnect"
  | "agencyId"
  | "createdAt"
  | "updatedAt"
> & {
  /** True when lat/lng are present — required for available-cameras radius search. */
  hasGps: boolean;
};

function stripDevice(device: LinkedRingDevice): PublicRingDevice {
  const hasGps =
    typeof device.latitude === "number" &&
    Number.isFinite(device.latitude) &&
    typeof device.longitude === "number" &&
    Number.isFinite(device.longitude);
  return {
    deviceId: device.deviceId,
    deviceName: device.deviceName,
    deviceType: device.deviceType,
    locationLabel: device.locationLabel,
    latitude: device.latitude,
    longitude: device.longitude,
    isEnabledForConnect: device.isEnabledForConnect,
    agencyId: device.agencyId,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt,
    hasGps,
  };
}

function configureRingTables(): void {
  if (env.ringDevicesTable) {
    process.env.RING_TABLE_DEVICES = env.ringDevicesTable;
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    configureRingTables();

    const user = await getUserContext(event);
    if (!user) {
      return ringJson({ success: false, error: "Unauthorized" }, 401);
    }
    if (!isUserAccountActive(user)) {
      return ringJson({ success: false, error: ACCOUNT_INACTIVE_MESSAGE }, 403);
    }
    const pwd = operationalPasswordBlock(user);
    if (pwd) {
      return ringJson({ success: false, error: "Password update is required before continuing." }, 403);
    }

    if (!isRingEnabled()) {
      return ringJson({ success: false, error: "Ring integration is not enabled." }, 403);
    }

    const deviceService = new RingDeviceService();
    const devices = await deviceService.getLinkedDevices(user.agencyId, user.userId);

    await auditRingEvent({
      type: AUDIT_EVENT_TYPES.RING_DEVICES_LISTED,
      agencyId: user.agencyId,
      actorId: user.userId,
      details: { deviceCount: devices.length },
    });

    return ringJson({
      success: true,
      data: { devices: devices.map(stripDevice) },
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_devices_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringJson({ success: false, error: "Unable to list Ring devices." }, 500);
  }
};
