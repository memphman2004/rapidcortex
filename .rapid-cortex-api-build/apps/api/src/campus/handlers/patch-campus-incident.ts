import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import {
  badRequest,
  badRequestFromZod,
  conflict,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { updateCampusIncident } from "../campus-incident-service.js";
import { updateIncidentSchema } from "../campus-schemas.js";

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
    authz.assertCanPerform(user, "campus.incidents.update" as never);

    const incidentId = event.pathParameters?.incidentId;
    const campusCode = event.queryStringParameters?.campusCode;
    if (!campusCode || !incidentId) {
      return withCorrelationHeaders(event, notFound("Missing campusCode query or incidentId path"));
    }

    let body: unknown;
    try {
      body = JSON.parse(event.body ?? "{}");
    } catch {
      return withCorrelationHeaders(event, badRequest("Invalid JSON"));
    }

    const parsed = updateIncidentSchema.safeParse(body);
    if (!parsed.success) {
      return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
    }

    try {
      const incident = await updateCampusIncident(
        campusCode,
        incidentId,
        parsed.data,
        user.userId,
        user.displayName ?? user.email,
      );
      return withCorrelationHeaders(event, ok({ incident }));
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === "NOT_FOUND") {
          return withCorrelationHeaders(event, notFound("Incident not found"));
        }
        if (err.message.startsWith("ILLEGAL_TRANSITION")) {
          return withCorrelationHeaders(event, conflict(err.message));
        }
      }
      throw err;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_PERMISSION") {
      return withCorrelationHeaders(event, forbidden());
    }
    console.error("[campus-incident-patch]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
