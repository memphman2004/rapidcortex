import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { ok, serverError, unauthorized } from "../../lib/response.js";
import { SalesLeadRepository } from "../../repositories/salesLeadRepository.js";

const repo = new SalesLeadRepository();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  if (!canAccessRcFinancePortal(user.role)) return ok({ error: "Forbidden" }, 403);

  try {
    const rawLimit = event.queryStringParameters?.limit;
    const limit = rawLimit ? Number(rawLimit) : 200;
    const items = await repo.listNormalized(Number.isFinite(limit) ? limit : 200);
    return ok({
      items,
      success: true,
      data: { items },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SALES_LEADS_TABLE_NOT_CONFIGURED") {
      return ok({ items: [], success: true, data: { items: [] } });
    }
    console.error("[listRcAdminLeads]", error);
    return serverError();
  }
};
