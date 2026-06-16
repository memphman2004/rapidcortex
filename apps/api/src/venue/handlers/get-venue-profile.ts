import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { forbidden, notFound, ok, serverError } from "../../lib/response.js";
import { getVenueProfile } from "../venue-profile-service.js";
import { requireVenueRouteContext } from "./venue-route-context.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ctx = await requireVenueRouteContext(event, "venue.settings.view");
    if ("response" in ctx) return ctx.response;

    const profile = await getVenueProfile(ctx.venueCode, ctx.agencyId);
    if (!profile) {
      return withCorrelationHeaders(event, notFound("Venue profile not found"));
    }

    return withCorrelationHeaders(event, ok({ profile }));
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_PERMISSION") {
      return withCorrelationHeaders(event, forbidden());
    }
    console.error("[venue-profile-get]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
