import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { badRequest, forbidden, notFound, ok, serverError, unauthorized } from "../../lib/response.js";
import { ApiClientsManagementService } from "../../services/apiClientsManagementService.js";

const svc = new ApiClientsManagementService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  const clientId = event.pathParameters?.clientId;
  if (!clientId) return badRequest("clientId required");
  try {
    const rotated = await svc.rotate(user, clientId, event.queryStringParameters?.agencyId ?? null);
    return ok({
      clientSecret: rotated.clientSecret,
      note: "Store the rotated client secret securely; it is never shown again.",
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "FORBIDDEN") return forbidden();
    if (e instanceof Error && e.message === "NOT_FOUND") return notFound("API client not found");
    return serverError();
  }
};
