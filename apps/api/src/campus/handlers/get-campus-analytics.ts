import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { badRequest, forbidden, ok, serverError, unauthorized } from "../../lib/response.js";
import { getCampusAnalytics } from "../campus-config-service.js";

const authz = new AuthorizationService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }
    const pwd = operationalPasswordBlock(user);
    if (pwd) return withCorrelationHeaders(event, pwd);
    authz.assertCanPerform(user, "campus.analytics.view" as never);

    const campusCode = event.queryStringParameters?.campusCode;
    if (!campusCode) {
      return withCorrelationHeaders(event, badRequest("campusCode is required"));
    }

    const range = (event.queryStringParameters?.range ?? "today") as "today" | "week" | "month";
    const analytics = await getCampusAnalytics(campusCode, range);
    return withCorrelationHeaders(event, ok(analytics));
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_PERMISSION") {
      return withCorrelationHeaders(event, forbidden());
    }
    console.error("[campus-analytics-get]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
