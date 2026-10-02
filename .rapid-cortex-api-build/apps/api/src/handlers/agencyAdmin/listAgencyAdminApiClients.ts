import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { ok, unauthorized } from "../../lib/response.js";
import { ApiClientsManagementService } from "../../services/apiClientsManagementService.js";

const svc = new ApiClientsManagementService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  try {
    const items = await svc.list(user, {
      agencyId: event.queryStringParameters?.agencyId ?? null,
    });
    return ok({ items });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "FORBIDDEN") return ok({ error: "Forbidden" }, 403);
    if (e instanceof Error && e.message === "AGENCY_REQUIRED") return ok({ error: "agencyId required" }, 400);
    throw e;
  }
};
