import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { isRcsuperadmin } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { ok, unauthorized } from "../../lib/response.js";
import { ApiClientsManagementService } from "../../services/apiClientsManagementService.js";

const svc = new ApiClientsManagementService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  if (!isRcsuperadmin(user)) return ok({ error: "Forbidden" }, 403);
  try {
    const rows = await svc.listRcAdminCrossTenantScan(500);
    const agencyFilter = event.queryStringParameters?.agencyId?.trim();
    const statusFilter = event.queryStringParameters?.status?.trim()?.toLowerCase();
    let items = rows;
    if (agencyFilter) items = items.filter((r) => r.agencyId === agencyFilter);
    if (statusFilter) items = items.filter((r) => r.status.toLowerCase() === statusFilter);
    return ok({ items });
  } catch (e: unknown) {
    throw e;
  }
};
