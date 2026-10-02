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
import { TriageService } from "../../services/triageService.js";
import { env } from "../../lib/env.js";

const triage = new TriageService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableNonEmergencyTriage) {
      return serviceUnavailable("Non-emergency triage is not enabled for this deployment");
    }
    const incidentId = event.pathParameters?.id;
    if (!incidentId) return badRequest("Incident ID required");

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

    const result = await triage.getLatest(incidentId, user);
    return ok({ triage: result });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    return serverError();
  }
};
