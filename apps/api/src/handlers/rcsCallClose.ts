import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { rcsCallCloseBodySchema } from "rapid-cortex-shared";
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
import { canManageRcsCall, canSupervisorOverride } from "../features/rcs/rcs-authz.js";
import { evaluateClosureGate } from "../features/rcs/rcs-closure-gate.js";
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

    const parsed = rcsCallCloseBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const existing = await repo.getCall(user.agencyId, callId);
    if (!existing) return notFound();

    const gate = evaluateClosureGate({
      state: existing.state,
      requesterCanOverride: canSupervisorOverride(user),
      override: parsed.data.supervisorOverride,
    });

    if (!gate.allowed) {
      if (gate.statusCode === 400) return badRequest(gate.reason);
      if (gate.statusCode === 403) return forbidden(gate.reason);
      return conflict(gate.reason);
    }

    const now = new Date().toISOString();
    const updated = {
      ...existing,
      state: gate.overridden ? ("OVERRIDE_CLOSED" as const) : ("CLOSED" as const),
      closedAt: now,
      closedByUserId: user.userId,
      updatedAt: now,
      ...(gate.overridden && parsed.data.supervisorOverride
        ? {
            closureOverride: {
              byUserId: user.userId,
              byBadge: parsed.data.supervisorOverride.badge,
              reason: parsed.data.supervisorOverride.reason,
              at: now,
            },
          }
        : {}),
    };
    await repo.putCall(updated);

    await cancelEscalations(callId).catch((err) =>
      console.error(JSON.stringify({ msg: "rcs_cancel_escalations_failed", callId, error: err instanceof Error ? err.message : String(err) })),
    );

    await writeRcsAudit(
      user,
      gate.overridden ? AUDIT_EVENT_TYPES.RCS_CALL_OVERRIDE_CLOSED : AUDIT_EVENT_TYPES.RCS_CALL_CLOSED,
      callId,
      {
        fromState: existing.state,
        overridden: gate.overridden,
        ...(gate.overridden && parsed.data.supervisorOverride
          ? { badge: parsed.data.supervisorOverride.badge, reason: parsed.data.supervisorOverride.reason }
          : {}),
      },
    );

    return rcsJson(updated);
  } catch (e) {
    console.error("rcsCallClose", e);
    return serverError();
  }
};
