import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { forbidden, ok, serverError, unauthorized } from "../../lib/response.js";
import { DispatcherPerformanceService } from "../../services/dispatcherPerformanceService.js";

const service = new DispatcherPerformanceService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const q = event.queryStringParameters ?? {};
    const metrics = await service.metrics(user, {
      from: q.from,
      to: q.to,
      compareFrom: q.compareFrom,
      compareTo: q.compareTo,
    });
    return ok(metrics);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return forbidden();
    }
    return serverError();
  }
};
