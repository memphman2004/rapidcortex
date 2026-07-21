import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { RCS_CLOSED_STATES, rcsUnitPositionBodySchema } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { badRequestFromZod, forbidden, serverError, serviceUnavailable, unauthorized } from "../lib/response.js";
import { env } from "../lib/env.js";
import { requireAddon } from "../middleware/requireAddon.js";
import { canManageRcsCall } from "../features/rcs/rcs-authz.js";
import { isUnitOnScene } from "../features/rcs/rcs-geofence.js";
import { writeRcsAudit } from "../features/rcs/rcs-audit.js";
import { RcsRepository } from "../features/rcs/rcs-repository.js";
import { rcsJson } from "../features/rcs/rcs-api-response.js";
import { cancelEscalations } from "../features/rcs/rcs-scheduler.js";

const repo = new RcsRepository();
const requireRcsAddon = requireAddon("rcs.module");

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    if (!env.enableRcs) return serviceUnavailable("Response Continuity System is not enabled");

    const addonGate = await requireRcsAddon(event, user);
    if (addonGate) return addonGate;

    if (!canManageRcsCall(user)) return forbidden();

    const parsed = rcsUnitPositionBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const now = new Date().toISOString();
    await repo.putUnitPosition({
      agencyId: user.agencyId,
      unitId: parsed.data.unitId,
      callSign: parsed.data.callSign,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      updatedAt: now,
      assignedCallId: parsed.data.callId,
    });

    if (!parsed.data.callId) {
      return rcsJson({ unitId: parsed.data.unitId, latitude: parsed.data.latitude, longitude: parsed.data.longitude, updatedAt: now });
    }

    const call = await repo.getCall(user.agencyId, parsed.data.callId);
    if (!call || !call.location || RCS_CLOSED_STATES.includes(call.state)) {
      return rcsJson({ unitId: parsed.data.unitId, latitude: parsed.data.latitude, longitude: parsed.data.longitude, updatedAt: now });
    }

    const onScene = isUnitOnScene(
      parsed.data.latitude,
      parsed.data.longitude,
      call.location.latitude,
      call.location.longitude,
      call.arrivalRadiusMeters,
    );

    const otherUnits = call.units.filter((u) => u.unitId !== parsed.data.unitId);
    const nextUnits = [
      ...otherUnits,
      {
        unitId: parsed.data.unitId,
        callSign: parsed.data.callSign,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        updatedAt: now,
        onScene,
      },
    ];

    const shouldMarkArrived = onScene && call.state !== "UNIT_ARRIVED";
    const updated = {
      ...call,
      units: nextUnits,
      state: shouldMarkArrived ? ("UNIT_ARRIVED" as const) : call.state,
      updatedAt: now,
    };
    await repo.putCall(updated);

    if (shouldMarkArrived) {
      await cancelEscalations(call.callId).catch((err) =>
        console.error(JSON.stringify({ msg: "rcs_cancel_escalations_failed", callId: call.callId, error: err instanceof Error ? err.message : String(err) })),
      );
      await writeRcsAudit(user, AUDIT_EVENT_TYPES.RCS_CALL_STATE_CHANGED, call.callId, {
        fromState: call.state,
        toState: "UNIT_ARRIVED",
        unitId: parsed.data.unitId,
      });
    }

    return rcsJson(updated);
  } catch (e) {
    console.error("rcsUnitPosition", e);
    return serverError();
  }
};
