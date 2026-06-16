import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { venueSectionUpsertBodySchema } from "rapid-cortex-shared";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { badRequest, forbidden, ok, serverError } from "../../lib/response.js";
import { mapValidationError, parseBody } from "../../lib/validation.js";
import { upsertVenueSection } from "../venue-section-service.js";
import { requireVenueRouteContext } from "./venue-route-context.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const sectionId = event.pathParameters?.sectionId?.trim();
    if (!sectionId) {
      return withCorrelationHeaders(event, badRequest("sectionId is required"));
    }

    const ctx = await requireVenueRouteContext(event, "venue.sections.manage");
    if ("response" in ctx) return ctx.response;

    let body;
    try {
      body = parseBody(event, venueSectionUpsertBodySchema);
    } catch (error) {
      return withCorrelationHeaders(event, badRequest(mapValidationError(error).message));
    }

    if (body.id !== sectionId) {
      return withCorrelationHeaders(event, badRequest("section id mismatch"));
    }

    const section = await upsertVenueSection({
      venueCode: ctx.venueCode,
      agencyId: ctx.agencyId,
      actorId: ctx.user.userId,
      body,
    });

    return withCorrelationHeaders(event, ok({ section }));
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN_PERMISSION") {
        return withCorrelationHeaders(event, forbidden());
      }
      if (error.message === "FORBIDDEN_TENANT") {
        return withCorrelationHeaders(event, forbidden());
      }
    }
    console.error("[venue-section-put]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
