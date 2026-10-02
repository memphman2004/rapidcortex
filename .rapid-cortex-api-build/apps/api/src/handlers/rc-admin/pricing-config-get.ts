import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { ok, serverError, unauthorized } from "../../lib/response.js";
import { readGlobalConfig } from "../../pricing/pricing-store.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  if (!canAccessRcFinancePortal(user.role)) return ok({ error: "Forbidden" }, 403);

  try {
    const config = await readGlobalConfig();
    return ok(config);
  } catch (error) {
    console.error("[pricing-config-get]", error);
    return serverError();
  }
};
