import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { badRequest, forbidden, ok, serverError, unauthorized } from "../lib/response.js";
import { AnalysisService } from "../services/analysisService.js";
import { requireAddon } from "../middleware/requireAddon.js";

const service = new AnalysisService();
const requireAnalysisAddon = requireAddon("ai.");
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const incidentId = event.pathParameters?.id;
    if (!incidentId) return badRequest("Incident ID required");

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const addonGate = await requireAnalysisAddon(event, user);
    if (addonGate) return addonGate;
    const analyses = await service.list(incidentId, user);
    return ok({ items: analyses });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return forbidden();
    }
    return serverError();
  }
};
