import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { IncidentShareService } from "../../services/incidentShareService.js";

const service = new IncidentShareService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const incidentId = event.pathParameters?.id;
    const shareId = event.pathParameters?.shareId;
    if (!incidentId || !shareId) return badRequest("Incident ID and share ID required");

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    await service.revokeShare(incidentId, shareId, user);
    return ok({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    if (error instanceof Error && error.message === "NOT_FOUND") return notFound("Share not found");
    if (error instanceof Error && error.message === "FEATURE_DISABLED")
      return notFound("Sharing disabled");
    return serverError();
  }
};
