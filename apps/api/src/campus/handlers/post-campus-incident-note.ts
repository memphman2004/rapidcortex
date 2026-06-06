import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { addIncidentNote } from "../campus-incident-service.js";
import { addNoteSchema } from "../campus-schemas.js";

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
    authz.assertCanPerform(user, "campus.incidents.view" as never);

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

    const parsed = addNoteSchema.safeParse(body);
    if (!parsed.success) {
      return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
    }

    const note = await addIncidentNote(
      campusCode,
      incidentId,
      parsed.data.content,
      user.userId,
      user.displayName ?? user.email,
    );

    return withCorrelationHeaders(event, ok({ note }, 201));
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_PERMISSION") {
      return withCorrelationHeaders(event, forbidden());
    }
    console.error("[campus-incident-note]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
