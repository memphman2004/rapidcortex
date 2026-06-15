import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { canAccessRcFinancePortal } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { ok, serverError, unauthorized } from "../../lib/response.js";
import { PendingProvisionRepository } from "../../repositories/pendingProvisionRepository.js";

const repo = new PendingProvisionRepository();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  if (!canAccessRcFinancePortal(user.role)) return ok({ error: "Forbidden" }, 403);

  try {
    const items = await repo.listRecent(200);
    return ok({ items });
  } catch (error) {
    if (error instanceof Error && error.message === "PENDING_PROVISIONS_TABLE_NOT_CONFIGURED") {
      return ok({ items: [] });
    }
    console.error("[listRcAdminAgreements]", error);
    return serverError();
  }
};
