import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { operationalPasswordBlock } from "../lib/operationalPasswordGate.js";
import { badRequest, ok, serverError, unauthorized } from "../lib/response.js";
import { IncidentService } from "../services/incidentService.js";

const service = new IncidentService();
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const pwd = operationalPasswordBlock(user);
    if (pwd) return pwd;
    const agencyId = event.queryStringParameters?.agencyId ?? undefined;
    const incidents = await service.list(user, agencyId);
    return ok({ items: incidents });
  } catch (error) {
    if (error instanceof Error && error.message === "AGENCY_QUERY_REQUIRED") {
      return badRequest('RC Super Admin ("rcsuperadmin") must pass agencyId query parameter');
    }
    return serverError();
  }
};
