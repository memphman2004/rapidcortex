import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { forbidden, ok, serverError, unauthorized } from "../../lib/response.js";
import { CallControlService } from "../../services/callControlService.js";

const service = new CallControlService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const items = await service.listAgencyActiveCalls(user);
    return ok({ items });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return forbidden();
    if (e instanceof Error && e.message === "ACTIVE_CALLS_UNAVAILABLE") return serverError();
    return serverError();
  }
};
