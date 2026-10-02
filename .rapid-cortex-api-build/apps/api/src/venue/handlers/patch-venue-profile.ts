import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { venueProfilePatchSchema } from "rapid-cortex-shared";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { badRequest, forbidden, ok, serverError } from "../../lib/response.js";
import { mapValidationError, parseBody } from "../../lib/validation.js";
import { patchVenueProfile } from "../venue-profile-service.js";
import { requireVenueRouteContext } from "./venue-route-context.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ctx = await requireVenueRouteContext(event, "venue.settings.manage");
    if ("response" in ctx) return ctx.response;

    let patch;
    try {
      patch = parseBody(event, venueProfilePatchSchema);
    } catch (error) {
      return withCorrelationHeaders(event, badRequest(mapValidationError(error).message));
    }

    try {
      const profile = await patchVenueProfile({
        venueCode: ctx.venueCode,
        agencyId: ctx.agencyId,
        actorId: ctx.user.userId,
        patch,
      });
      return withCorrelationHeaders(event, ok({ profile }));
    } catch (error) {
      if (error instanceof Error && error.message === "FORBIDDEN_TENANT") {
        return withCorrelationHeaders(event, forbidden());
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_PERMISSION") {
      return withCorrelationHeaders(event, forbidden());
    }
    console.error("[venue-profile-patch]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
