import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { badRequest, forbidden, notFound, ok, serverError } from "../../lib/response.js";
import { deleteVenueSection } from "../venue-section-service.js";
import { requireVenueRouteContext } from "./venue-route-context.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const sectionId = event.pathParameters?.sectionId?.trim();
    if (!sectionId) {
      return withCorrelationHeaders(event, badRequest("sectionId is required"));
    }

    const ctx = await requireVenueRouteContext(event, "venue.sections.manage");
    if ("response" in ctx) return ctx.response;

    try {
      await deleteVenueSection({
        venueCode: ctx.venueCode,
        agencyId: ctx.agencyId,
        actorId: ctx.user.userId,
        sectionId,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") {
        return withCorrelationHeaders(event, notFound("Section not found"));
      }
      throw error;
    }

    return withCorrelationHeaders(event, ok({ deleted: true }));
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_PERMISSION") {
      return withCorrelationHeaders(event, forbidden());
    }
    console.error("[venue-section-delete]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
