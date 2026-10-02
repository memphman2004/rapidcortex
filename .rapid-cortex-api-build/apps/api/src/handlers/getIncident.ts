import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { operationalPasswordBlock } from "../lib/operationalPasswordGate.js";
import { withCorrelationHeaders } from "../lib/correlation.js";
import { forbidden, notFound, ok, serverError, unauthorized } from "../lib/response.js";
import { IncidentService } from "../services/incidentService.js";

const service = new IncidentService();
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const incidentId = event.pathParameters?.id;
    if (!incidentId) return withCorrelationHeaders(event, notFound("Incident ID is required"));

    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user))
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    const pwd = operationalPasswordBlock(user);
    if (pwd) return withCorrelationHeaders(event, pwd);
    const incident = await service.get(incidentId, user);
    if (!incident)
      return withCorrelationHeaders(event, forbidden("Incident not found or access denied"));

    return withCorrelationHeaders(event, ok(incident));
  } catch {
    return withCorrelationHeaders(event, serverError());
  }
};
