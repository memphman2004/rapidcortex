import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { badRequest, forbidden, ok, serverError, unauthorized } from "../../lib/response.js";
import { WebhooksManagementService } from "../../services/webhooksManagementService.js";

const svc = new WebhooksManagementService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  try {
    const items = await svc.list(user, event.queryStringParameters?.agencyId ?? null);
    return ok({ items });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "FORBIDDEN") return forbidden();
    if (e instanceof Error && e.message === "AGENCY_REQUIRED") return badRequest("agencyId required");
    return serverError();
  }
};
