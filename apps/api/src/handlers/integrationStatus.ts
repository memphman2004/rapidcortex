import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { buildIntegrationStatusPayload } from "../lib/integration-surface.js";
import { forbidden, ok, unauthorized } from "../lib/response.js";

const authz = new AuthorizationService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  if (!authz.canAccessAdminRoutes(user)) return forbidden();
  return ok(buildIntegrationStatusPayload(user.agencyId));
};
