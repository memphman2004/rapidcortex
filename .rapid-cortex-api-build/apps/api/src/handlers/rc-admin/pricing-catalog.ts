import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { ok, serverError, unauthorized } from "../../lib/response.js";
import { readCatalog } from "../../pricing/pricing-store.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  if (!canAccessRcFinancePortal(user.role)) return ok({ error: "Forbidden" }, 403);

  try {
    const agencyId = event.queryStringParameters?.agencyId;
    const { items, version, updatedAt } = await readCatalog(agencyId);

    const counts = {
      core: 0,
      addon: 0,
      professional: 0,
      support: 0,
      rc_lite: 0,
      vertical: 0,
      total: items.length,
    };
    for (const item of items) {
      if (item.category in counts) {
        (counts as Record<string, number>)[item.category]++;
      }
    }

    return ok({ items, counts, version, updatedAt });
  } catch (error) {
    console.error("[pricing-catalog]", error);
    return serverError();
  }
};
