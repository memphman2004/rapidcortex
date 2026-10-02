import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { venueSectionStatusPatchSchema } from "rapid-cortex-shared";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { badRequest, forbidden, notFound, ok, serverError } from "../../lib/response.js";
import { mapValidationError, parseBody } from "../../lib/validation.js";
import { patchVenueSectionStatus } from "../venue-section-service.js";
import { requireVenueRouteContext } from "./venue-route-context.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const sectionId = event.pathParameters?.sectionId?.trim();
    if (!sectionId) {
      return withCorrelationHeaders(event, badRequest("sectionId is required"));
    }

    const ctx = await requireVenueRouteContext(event, "venue.sections.status");
    if ("response" in ctx) return ctx.response;

    let patch;
    try {
      patch = parseBody(event, venueSectionStatusPatchSchema);
    } catch (error) {
      return withCorrelationHeaders(event, badRequest(mapValidationError(error).message));
    }

    try {
      const section = await patchVenueSectionStatus({
        venueCode: ctx.venueCode,
        agencyId: ctx.agencyId,
        actorId: ctx.user.userId,
        sectionId,
        patch,
      });
      return withCorrelationHeaders(event, ok({ section }));
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") {
        return withCorrelationHeaders(event, notFound("Section not found"));
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_PERMISSION") {
      return withCorrelationHeaders(event, forbidden());
    }
    console.error("[venue-section-status-patch]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
