import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { forbidden, notFound, ok, serverError, unauthorized } from "../lib/response.js";
import { AgencyService } from "../services/agencyService.js";

const service = new AgencyService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const agencyId = event.pathParameters?.id;
    if (!agencyId) return notFound("Agency id required");
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const row = await service.get(user, agencyId);
    if (!row) return notFound("Agency not found");
    return ok(row);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    return serverError();
  }
};
