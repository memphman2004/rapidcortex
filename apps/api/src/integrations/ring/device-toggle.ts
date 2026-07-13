import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ringDeviceToggleBodySchema } from "rapid-cortex-shared";
import { isRingEnabled, RingDeviceService } from "../../lib/ring-integration.js";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { env } from "../../lib/env.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { auditRingEvent, AUDIT_EVENT_TYPES } from "./ring-audit.js";
import { ringJson } from "./ring-api-response.js";

const deviceService = new RingDeviceService();

function configureRingTables(): void {
  if (env.ringDevicesTable) {
    process.env.RING_TABLE_DEVICES = env.ringDevicesTable;
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    configureRingTables();

    const user = await getUserContext(event);
    if (!user) return ringJson({ success: false, error: "Unauthorized" }, 401);
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

    const deviceId = event.pathParameters?.deviceId;
    if (!deviceId) {
      return ringJson({ success: false, error: "deviceId is required." }, 400);
    }

    let body: unknown;
    try {
      body = JSON.parse(event.body ?? "{}");
    } catch {
      return ringJson({ success: false, error: "Invalid request body." }, 400);
    }
    const parsed = ringDeviceToggleBodySchema.safeParse(body);
    if (!parsed.success) {
      return ringJson({ success: false, error: "Invalid request body." }, 400);
    }

    const device = await deviceService.getDeviceByAgencyAndDeviceId(user.agencyId, deviceId);
    if (!device || device.agencyId !== user.agencyId || device.userId !== user.userId) {
      return ringJson({ success: false, error: "Device not found." }, 404);
    }

    await deviceService.setDeviceConnectEnabled(
      user.agencyId,
      user.userId,
      deviceId,
      parsed.data.isEnabledForConnect,
    );

    await auditRingEvent({
      type: AUDIT_EVENT_TYPES.RING_DEVICE_CONNECT_TOGGLED,
      agencyId: user.agencyId,
      actorId: user.userId,
      details: { deviceId, isEnabledForConnect: parsed.data.isEnabledForConnect },
      resourceId: deviceId,
    });

    return ringJson({
      success: true,
      data: { deviceId, isEnabledForConnect: parsed.data.isEnabledForConnect },
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_device_toggle_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringJson({ success: false, error: "Unable to update device." }, 500);
  }
};
