import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  RCS_CLOSED_STATES,
  rcsSoftHandoffAcceptRequestSchema,
  rcsSoftHandoffRequestSchema,
  type RcsSoftHandoff,
} from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import {
  badRequestFromZod,
  forbidden,
  jsonStatus,
  notFound,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../lib/response.js";
import { env } from "../lib/env.js";
import { requireAddon } from "../middleware/requireAddon.js";
import {
  canAcceptSoftHandoff,
  canManageRcsCall,
  canRequestSoftHandoff,
  canSupervisorOverride,
} from "../features/rcs/rcs-authz.js";
import { RcsRepository } from "../features/rcs/rcs-repository.js";
import { rcsJson } from "../features/rcs/rcs-api-response.js";
import { publishRcsEvent } from "../features/rcs/rcs-ws.js";

const repo = new RcsRepository();
const requireRcsAddon = requireAddon("rcs.module");
const CLOSED = new Set<string>(RCS_CLOSED_STATES);

function displayName(user: { displayName?: string; email?: string; userId: string }): string {
  return user.email?.trim() || user.displayName?.trim() || user.userId;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    if (!env.enableRcs) return serviceUnavailable("Response Continuity System is not enabled");

    const addonGate = await requireRcsAddon(event, user);
    if (addonGate) return addonGate;

    const callId = event.pathParameters?.callId?.trim();
    if (!callId) return notFound("callId required");

    const path = event.rawPath ?? event.requestContext.http?.path ?? "";
    const method = (event.requestContext.http?.method ?? "POST").toUpperCase();
    const isAccept = path.includes("/handoff/accept");

    const call = await repo.getCall(user.agencyId, callId);
    if (!call) return notFound("RCS call not found");
    if (CLOSED.has(call.state)) return forbidden();

    if (method === "POST" && isAccept) {
      const parsed = rcsSoftHandoffAcceptRequestSchema.safeParse(
        JSON.parse(event.body ?? "{}"),
      );
      if (!parsed.success) return badRequestFromZod(parsed.error);
      if (!call.softHandoff || call.softHandoff.state !== "REQUESTED") {
        return forbidden();
      }
      if (!canAcceptSoftHandoff(user, call.softHandoff.requestedByUserId)) {
        return forbidden();
      }

      const now = new Date().toISOString();
      const handoff: RcsSoftHandoff = {
        ...call.softHandoff,
        state: "ACTIVE",
        acceptedByUserId: user.userId,
        acceptedByDisplayName: parsed.data.acceptorDisplayName,
        acceptedAt: now,
      };
      const updated = await repo.updateCallAttributes(user.agencyId, callId, {
        softHandoff: handoff,
        updatedAt: now,
      });
      if (!updated) return serverError();

      await publishRcsEvent({
        type: "rcs:handoff:accepted",
        callId,
        agencyId: user.agencyId,
        handoff,
      });
      return rcsJson({ handoff });
    }

    if (method === "POST") {
      const parsed = rcsSoftHandoffRequestSchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      if (!canRequestSoftHandoff(user, call.assignedDispatcherId)) return forbidden();

      const now = new Date().toISOString();
      const handoff: RcsSoftHandoff = {
        state: "REQUESTED",
        requestedByUserId: user.userId,
        requestedByDisplayName: displayName(user),
        requestedAt: now,
        note: parsed.data.note,
      };
      const updated = await repo.updateCallAttributes(user.agencyId, callId, {
        softHandoff: handoff,
        updatedAt: now,
      });
      if (!updated) return serverError();

      await publishRcsEvent({
        type: "rcs:handoff:requested",
        callId,
        agencyId: user.agencyId,
        handoff,
        incidentId: call.incidentId,
      });
      return rcsJson({ handoff });
    }

    if (method === "DELETE") {
      if (!canManageRcsCall(user) && !canSupervisorOverride(user)) return forbidden();
      if (
        call.softHandoff?.requestedByUserId !== user.userId &&
        !canSupervisorOverride(user)
      ) {
        return forbidden();
      }
      const now = new Date().toISOString();
      const handoff: RcsSoftHandoff | undefined = call.softHandoff
        ? { ...call.softHandoff, state: "CLEARED" }
        : undefined;
      await repo.updateCallAttributes(user.agencyId, callId, {
        softHandoff: handoff,
        updatedAt: now,
      });
      await publishRcsEvent({
        type: "rcs:handoff:cleared",
        callId,
        agencyId: user.agencyId,
      });
      return jsonStatus({ success: true }, 204);
    }

    return forbidden();
  } catch (e) {
    console.error("rcsCallHandoff", e);
    return serverError();
  }
};
