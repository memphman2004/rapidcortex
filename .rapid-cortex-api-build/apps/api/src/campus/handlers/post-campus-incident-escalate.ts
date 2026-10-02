import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { forbidden, notFound, ok, serverError, unauthorized } from "../../lib/response.js";
import { escalateCampusIncident } from "../campus-incident-service.js";

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
    authz.assertCanPerform(user, "campus.incidents.escalate" as never);

    const incidentId = event.pathParameters?.incidentId;
    const campusCode = event.queryStringParameters?.campusCode;
    if (!campusCode || !incidentId) {
      return withCorrelationHeaders(event, notFound("Missing campusCode query or incidentId path"));
    }

    const result = await escalateCampusIncident(campusCode, incidentId, user.userId);
    return withCorrelationHeaders(
      event,
      ok({
        ...result,
        escalatedAt: new Date().toISOString(),
        message: "Incident escalated. Emergency communications notified.",
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_PERMISSION") {
      return withCorrelationHeaders(event, forbidden());
    }
    console.error("[campus-incident-escalate]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
