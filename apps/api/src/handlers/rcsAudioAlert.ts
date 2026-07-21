import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { RCS_CLOSED_STATES, rcsAudioAlertBodySchema } from "rapid-cortex-shared";
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

const repo = new RcsRepository();
const requireRcsAddon = requireAddon("rcs.module");

/** Audio sentinel escalates the call's tier when the caller's ambient audio reads as dangerous. */
const AUDIO_STATUSES_THAT_ESCALATE = new Set(["ALERT", "CONFIRMED_DANGER"]);

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

    const parsed = rcsAudioAlertBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const existing = await repo.getCall(user.agencyId, callId);
    if (!existing) return notFound();
    if (RCS_CLOSED_STATES.includes(existing.state)) return conflict("RCS_CALL_ALREADY_CLOSED");

    const escalate = AUDIO_STATUSES_THAT_ESCALATE.has(parsed.data.audioStatus);
    const updated = {
      ...existing,
      audioStatus: parsed.data.audioStatus,
      state: escalate ? ("AUDIO_ALERT" as const) : existing.state,
      notes: parsed.data.detail ?? existing.notes,
      updatedAt: new Date().toISOString(),
    };
    await repo.putCall(updated);

    await writeRcsAudit(user, AUDIT_EVENT_TYPES.RCS_CALL_AUDIO_ALERT, callId, {
      audioStatus: parsed.data.audioStatus,
      detail: parsed.data.detail,
    });

    return rcsJson(updated);
  } catch (e) {
    console.error("rcsAudioAlert", e);
    return serverError();
  }
};
