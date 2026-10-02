import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { forbidden, notFound, serverError, serviceUnavailable, unauthorized } from "../lib/response.js";
import { env } from "../lib/env.js";
import { requireAddon } from "../middleware/requireAddon.js";
import { canManageRcsCall, canReadRcs } from "../features/rcs/rcs-authz.js";
import { RcsRepository } from "../features/rcs/rcs-repository.js";
import { rcsJson } from "../features/rcs/rcs-api-response.js";
import { generateRcsAiSummary } from "../features/rcs/rcs-intelligence.js";
import { publishRcsEvent } from "../features/rcs/rcs-ws.js";

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

    const callId = event.pathParameters?.callId?.trim();
    if (!callId) return notFound("callId required");

    const method = (event.requestContext.http?.method ?? "GET").toUpperCase();

    if (method === "GET") {
      if (!canReadRcs(user)) return forbidden();
      const call = await repo.getCall(user.agencyId, callId);
      if (!call) return notFound("RCS call not found");
      if (!call.aiSummary) return notFound("Summary not available yet");
      return rcsJson({ summary: call.aiSummary });
    }

    if (method === "POST") {
      if (!canManageRcsCall(user)) return forbidden();
      const call = await repo.getCall(user.agencyId, callId);
      if (!call) return notFound("RCS call not found");

      const summary = await generateRcsAiSummary(call);
      const now = new Date().toISOString();
      const updated = await repo.updateCallAttributes(user.agencyId, callId, {
        aiSummary: summary,
        updatedAt: now,
        ...(call.stateEnteredAt ? {} : { stateEnteredAt: call.createdAt }),
      });
      if (!updated) return serverError();

      await publishRcsEvent({
        type: "rcs:summary:updated",
        callId,
        agencyId: user.agencyId,
        summary,
      });

      return rcsJson({ summary });
    }

    return forbidden();
  } catch (e) {
    console.error("rcsCallSummary", e);
    return serverError();
  }
};
