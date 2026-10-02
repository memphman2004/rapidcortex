import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { forbidden, ok, serverError, unauthorized } from "../lib/response.js";
import { normalizeAuditEventForApi } from "../lib/auditDisplay.js";
import { PlatformCommandService } from "../services/platformCommandService.js";

const service = new PlatformCommandService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const p = event.queryStringParameters ?? {};
    const limit = Number(p.limit) || 50;
    const perAgencyCap = Number(p.perAgencyCap) || 30;
    const items = await service.listGlobalAudit(user, {
      limit,
      perAgencyCap,
      agencyId: p.agencyId?.trim() || undefined,
      typePrefix: p.type?.trim() || undefined,
      fromIso: p.from?.trim() || undefined,
      toIso: p.to?.trim() || undefined,
    });
    return ok({ items: items.map((e) => normalizeAuditEventForApi(e)) });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return forbidden();
    }
    return serverError();
  }
};
