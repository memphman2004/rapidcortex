import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  badRequest,
  forbidden,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { SopService } from "../../services/sopService.js";
import { env } from "../../lib/env.js";
import { incidentTimelineLogger } from "../../lib/incidentTimelineLogger.js";

const sop = new SopService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableSopProtocolAi) {
      return serviceUnavailable("SOP protocol detection is not enabled for this deployment");
    }
    const incidentId = event.pathParameters?.id;
    if (!incidentId) return badRequest("Incident ID required");

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

    const overlay = await sop.runDetectionAndPersist(incidentId, user, { manual: true });
    if (!overlay) return forbidden("Incident not found or access denied");

    await incidentTimelineLogger.emit({
      incidentId,
      agencyId: user.agencyId,
      kind: "manual_override",
      source: "dispatcher",
      actorId: user.userId,
      actorRole: user.role,
      payload: { manual: true },
    });

    return ok({ overlay });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    return serverError();
  }
};
