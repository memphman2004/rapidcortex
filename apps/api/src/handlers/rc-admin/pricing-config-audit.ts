import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { ok, serverError, unauthorized } from "../../lib/response.js";
import { readAuditLog } from "../../pricing/pricing-store.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  if (!canAccessRcFinancePortal(user.role)) return ok({ error: "Forbidden" }, 403);

  try {
    const limitRaw = event.queryStringParameters?.limit;
    const limit = Math.min(200, Math.max(1, Number.parseInt(limitRaw ?? "50", 10) || 50));
    const entries = await readAuditLog(limit);
    return ok({ entries });
  } catch (error) {
    console.error("[pricing-config-audit]", error);
    return serverError();
  }
};
