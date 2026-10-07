import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { badRequest, forbidden, ok, serverError, unauthorized } from "../../lib/response.js";
import { DispatcherPerformanceService } from "../../services/dispatcherPerformanceService.js";

const service = new DispatcherPerformanceService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const dispatcherUserId = event.pathParameters?.dispatcherUserId;
    if (!dispatcherUserId) return badRequest("dispatcherUserId required");

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const q = event.queryStringParameters ?? {};
    const detail = await service.dispatcherDetail(user, dispatcherUserId, {
      from: q.from,
      to: q.to,
      compareFrom: q.compareFrom,
      compareTo: q.compareTo,
    });
    return ok(detail);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return forbidden();
    }
    return serverError();
  }
};
