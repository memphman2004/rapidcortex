import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { RCS_CLOSED_STATES, rcsCallStateUpdateBodySchema } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import {
  badRequest,
  badRequestFromZod,
  conflict,
  forbidden,
  notFound,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../lib/response.js";
import { env } from "../lib/env.js";
import { requireAddon } from "../middleware/requireAddon.js";
import { canManageRcsCall } from "../features/rcs/rcs-authz.js";
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

    const callId = event.pathParameters?.callId?.trim();
    if (!callId) return badRequest("Missing callId");

    const parsed = rcsCallStateUpdateBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const existing = await repo.getCall(user.agencyId, callId);
    if (!existing) return notFound();
    if (RCS_CLOSED_STATES.includes(existing.state)) {
      return conflict("RCS_CALL_ALREADY_CLOSED");
    }

    const nextState = parsed.data.state;
    const updated = {
      ...existing,
      state: nextState,
      notes: parsed.data.notes ?? existing.notes,
      updatedAt: new Date().toISOString(),
    };
    await repo.putCall(updated);

    if (nextState === "UNIT_ARRIVED") {
      await cancelEscalations(callId).catch((err) =>
        console.error(JSON.stringify({ msg: "rcs_cancel_escalations_failed", callId, error: err instanceof Error ? err.message : String(err) })),
      );
    }

    await writeRcsAudit(
      user,
      nextState === "ESCALATED" ? AUDIT_EVENT_TYPES.RCS_CALL_ESCALATED : AUDIT_EVENT_TYPES.RCS_CALL_STATE_CHANGED,
      callId,
      { fromState: existing.state, toState: nextState },
    );

    return rcsJson(updated);
  } catch (e) {
    console.error("rcsCallState", e);
    return serverError();
  }
};
