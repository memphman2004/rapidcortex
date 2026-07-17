/**
 * GET /api/platform/deployments-map
 * RC Admin national cross-agency deployments map (rcsuperadmin / RC internal).
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { forbidden, ok, serverError, unauthorized } from "../lib/response.js";
import { AgencyService } from "../services/agencyService.js";

const service = new AgencyService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const payload = await service.listDeploymentsMap(user);
    return ok(payload);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    console.error(
      JSON.stringify({
        msg: "platform_deployments_map_error",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return serverError();
  }
};
