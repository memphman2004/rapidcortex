import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { RCS_CLOSED_STATES, rcsSupervisorAckBodySchema } from "rapid-cortex-shared";
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
import { canSupervisorOverride } from "../features/rcs/rcs-authz.js";
import { writeRcsAudit } from "../features/rcs/rcs-audit.js";
import { RcsRepository } from "../features/rcs/rcs-repository.js";
import { rcsJson } from "../features/rcs/rcs-api-response.js";

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

    // Supervisor-tier and above only — dispatchers cannot self-acknowledge an escalation.
    if (!canSupervisorOverride(user)) return forbidden();

    const callId = event.pathParameters?.callId?.trim();
    if (!callId) return badRequest("Missing callId");

    const parsed = rcsSupervisorAckBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const existing = await repo.getCall(user.agencyId, callId);
    if (!existing) return notFound();
    if (RCS_CLOSED_STATES.includes(existing.state)) return conflict("RCS_CALL_ALREADY_CLOSED");

    const now = new Date().toISOString();
    const updated = {
      ...existing,
      state: "SUPERVISOR_ACKNOWLEDGED" as const,
      supervisorAckByUserId: user.userId,
      supervisorAckAt: now,
      notes: parsed.data.note ?? existing.notes,
      updatedAt: now,
    };
    await repo.putCall(updated);

    await writeRcsAudit(user, AUDIT_EVENT_TYPES.RCS_CALL_SUPERVISOR_ACKNOWLEDGED, callId, {
      fromState: existing.state,
      note: parsed.data.note,
    });

    return rcsJson(updated);
  } catch (e) {
    console.error("rcsSupervisorAck", e);
    return serverError();
  }
};
