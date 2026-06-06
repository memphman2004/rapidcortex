import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { badRequest, forbidden, ok, serverError, unauthorized } from "../../lib/response.js";
import { listCampusIncidents } from "../campus-incident-service.js";

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
    const campusCode = event.queryStringParameters?.campusCode;
    if (!campusCode) {
      return withCorrelationHeaders(event, badRequest("campusCode is required"));
    }

    const agencyId = user.agencyId ?? "";
    const normalizedAgency = agencyId.replace(/^(test-)?campus-/, "").toUpperCase().replace(/-/g, "");
    if (normalizedAgency !== campusCode.toUpperCase() && !agencyId.startsWith("rc") && !agencyId.startsWith("RC")) {
      return withCorrelationHeaders(event, forbidden("Campus code mismatch"));
    }

    const status = event.queryStringParameters?.status?.split(",") as string[] | undefined;
    const type = event.queryStringParameters?.type?.split(",") as string[] | undefined;
    const confidentialOnly = event.queryStringParameters?.confidential === "true";
    const cursor = event.queryStringParameters?.cursor;
    const limit = parseInt(event.queryStringParameters?.limit ?? "25", 10);

    const result = await listCampusIncidents({
      campusCode,
      status: status as never,
      type: type as never,
      confidentialOnly,
      limit: Math.min(limit, 100),
      cursor,
    });

    return withCorrelationHeaders(event, ok(result));
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_PERMISSION") {
      return withCorrelationHeaders(event, forbidden());
    }
    console.error("[campus-incidents-get]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
