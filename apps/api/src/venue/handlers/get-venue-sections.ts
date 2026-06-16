import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { forbidden, notFound, ok, serverError } from "../../lib/response.js";
import { listVenueSections } from "../venue-section-service.js";
import { requireVenueRouteContext } from "./venue-route-context.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ctx = await requireVenueRouteContext(event, "venue.sections.view");
    if ("response" in ctx) return ctx.response;

    const sections = await listVenueSections(ctx.venueCode, ctx.agencyId);
    return withCorrelationHeaders(event, ok({ sections }));
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_PERMISSION") {
      return withCorrelationHeaders(event, forbidden());
    }
    console.error("[venue-sections-get]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
