import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { isRcsuperadmin } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { ok, unauthorized } from "../lib/response.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  return ok({
    user,
    principalKind: isRcsuperadmin(user) ? "platform" : "agency",
  });
};
