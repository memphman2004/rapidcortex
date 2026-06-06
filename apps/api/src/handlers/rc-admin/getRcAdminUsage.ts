import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { canAccessRcUsagePortal } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { ok, unauthorized } from "../../lib/response.js";
import { RcAdminUsageService } from "../../services/rcAdminUsageService.js";

const svc = new RcAdminUsageService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  if (!canAccessRcUsagePortal(user.role)) return ok({ error: "Forbidden" }, 403);

  const yearMonth = event.queryStringParameters?.yearMonth?.trim();
  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    return ok({ error: "yearMonth query required (YYYY-MM)" }, 400);
  }

  const customers = await svc.listCustomersForMonth(yearMonth);
  return ok({ customers, yearMonth });
};
