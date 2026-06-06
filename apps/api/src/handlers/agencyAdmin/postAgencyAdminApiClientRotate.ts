import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { ok, unauthorized } from "../../lib/response.js";
import { ApiClientsManagementService } from "../../services/apiClientsManagementService.js";

const svc = new ApiClientsManagementService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  const clientId = event.pathParameters?.clientId;
  if (!clientId) return ok({ error: "clientId required" }, 400);
  try {
    const rotated = await svc.rotate(user, clientId, event.queryStringParameters?.agencyId ?? null);
    return ok({
      clientSecret: rotated.clientSecret,
      note: "Store the rotated client secret securely; it is never shown again.",
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "FORBIDDEN") return ok({ error: "Forbidden" }, 403);
    if (e instanceof Error && e.message === "NOT_FOUND") return ok({ error: "Not found" }, 404);
    throw e;
  }
};
