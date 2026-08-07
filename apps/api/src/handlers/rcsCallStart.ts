import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { rcsCallStartBodySchema } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { badRequestFromZod, forbidden, serverError, serviceUnavailable, unauthorized } from "../lib/response.js";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { requireAddon } from "../middleware/requireAddon.js";
import { canManageRcsCall } from "../features/rcs/rcs-authz.js";
import { writeRcsAudit } from "../features/rcs/rcs-audit.js";
import { RcsRepository } from "../features/rcs/rcs-repository.js";
import { rcsJson } from "../features/rcs/rcs-api-response.js";
import { scheduleEscalations } from "../features/rcs/rcs-scheduler.js";

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

    const parsed = rcsCallStartBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const now = new Date().toISOString();
    const call = {
      callId: makeId("rcs"),
      agencyId: user.agencyId,
      incidentId: parsed.data.incidentId,
      callerPhone: parsed.data.callerPhone,
      state: "MONITORING" as const,
      escalationLevel: "NONE" as const,
      audioStatus: "SILENT" as const,
      location: parsed.data.location,
      arrivalRadiusMeters: parsed.data.arrivalRadiusMeters ?? env.rcsArrivalRadiusMeters,
      units: [],
      createdAt: now,
      updatedAt: now,
      createdByUserId: user.userId,
      assignedDispatcherId: user.userId,
      assignedDispatcherDisplayName:
        user.email?.trim() || user.displayName?.trim() || user.userId,
      notes: parsed.data.notes,
    };

    await repo.createCall(call);
    await writeRcsAudit(user, AUDIT_EVENT_TYPES.RCS_CALL_STARTED, call.callId, {
      incidentId: call.incidentId,
      hasLocation: Boolean(call.location),
    });

    try {
      await scheduleEscalations(call.callId, call.agencyId);
    } catch (err) {
      console.error(JSON.stringify({ msg: "rcs_call_start_schedule_failed", callId: call.callId, error: err instanceof Error ? err.message : String(err) }));
    }

    return rcsJson(call, 201);
  } catch (e) {
    console.error("rcsCallStart", e);
    return serverError();
  }
};
