import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { QAService } from "../../services/qaService.js";

const service = new QAService();
const authz = new AuthorizationService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    authz.assertCanPerform(user, "qa.scorecards_create");
    if (!authz.canDispatch(user)) return forbidden();
    const sessionId = event.pathParameters?.id;
    if (!sessionId) return notFound();
    const updated = await service.runScoring(user, sessionId);
    return ok(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = (e as Error & { statusCode?: number }).statusCode;
    if (msg === "FORBIDDEN_PERMISSION" && statusCode === 403) return forbidden();
    if (msg === "QA_DISABLED" || msg === "QA_TABLES_NOT_CONFIGURED") {
      return serviceUnavailable("QA scoring is not enabled for this deployment");
    }
    if (msg === "NOT_FOUND") return notFound();
    if (msg === "FORBIDDEN" || msg === "TENANT_MISMATCH") return forbidden();
    return serverError();
  }
};
