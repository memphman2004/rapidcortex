import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { badRequest, forbidden, notFound, ok, serverError, unauthorized } from "../../lib/response.js";
import { getVenueIncident } from "../venue-incident-service.js";

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
    const incidentId = event.pathParameters?.incidentId?.trim();
    if (!venueCode || !incidentId) {
      return withCorrelationHeaders(event, badRequest("venueCode and incidentId are required"));
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

    const incident = await getVenueIncident({ venueCode, agencyId, incidentId });
    if (!incident) {
      return withCorrelationHeaders(event, notFound("Incident not found"));
    }

    return withCorrelationHeaders(event, ok({ incident }));
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_PERMISSION") {
      return withCorrelationHeaders(event, forbidden());
    }
    console.error("[venue-incident-get]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
