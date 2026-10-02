import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { forbidden, ok, serverError, unauthorized } from "../lib/response.js";
import { AuditQueryService } from "../services/auditQueryService.js";

const service = new AuditQueryService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

    const limitRaw = event.queryStringParameters?.limit;
    const limit = Math.min(100, Math.max(1, Number(limitRaw) || 50));

    const items = await service.listForUser(user, limit);
    return ok({ items });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return forbidden();
    }
    return serverError();
  }
};
