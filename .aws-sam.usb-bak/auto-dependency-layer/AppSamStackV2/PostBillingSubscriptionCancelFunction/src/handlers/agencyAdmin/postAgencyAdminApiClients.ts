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
    const body = JSON.parse(event.body ?? "{}") as unknown;
    const created = await svc.create(user, body);
    return ok(
      {
        record: created.record,
        clientSecret: created.clientSecret,
        note: "Store the client secret securely; it is never shown again.",
      },
      201,
    );
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "FORBIDDEN") return ok({ error: "Forbidden" }, 403);
    throw e;
  }
};
