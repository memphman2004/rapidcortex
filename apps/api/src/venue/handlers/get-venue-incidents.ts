import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { badRequest, forbidden, ok, serverError, unauthorized } from "../../lib/response.js";
import { listVenueIncidents } from "../venue-incident-service.js";

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

    authz.assertCanPerform(user, "incidents.view");

    const venueCode = event.queryStringParameters?.venueCode?.trim();
    if (!venueCode) {
      return withCorrelationHeaders(event, badRequest("venueCode is required"));
    }

    const agencyId = user.agencyId ?? "";
    const normalizedAgency = agencyId.replace(/^(test-)?venue-/, "").toUpperCase().replace(/-/g, "");
    const normalizedVenue = venueCode.toUpperCase().replace(/-/g, "");
    if (
      normalizedAgency !== normalizedVenue &&
      !agencyId.startsWith("rc") &&
      !agencyId.startsWith("RC")
    ) {
      return withCorrelationHeaders(event, forbidden("Venue code mismatch"));
    }

    const status = event.queryStringParameters?.status?.split(",") as
      | Array<"open" | "assigned" | "responding" | "resolved" | "escalated">
      | undefined;
    const type = event.queryStringParameters?.type?.split(",") as string[] | undefined;
    const cursor = event.queryStringParameters?.cursor;
    const limit = parseInt(event.queryStringParameters?.limit ?? "25", 10);

    const result = await listVenueIncidents({
      venueCode,
      agencyId,
      status,
      type: type as never,
      limit: Math.min(limit, 100),
      cursor,
    });

    return withCorrelationHeaders(event, ok(result));
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_PERMISSION") {
      return withCorrelationHeaders(event, forbidden());
    }
    console.error("[venue-incidents-get]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
