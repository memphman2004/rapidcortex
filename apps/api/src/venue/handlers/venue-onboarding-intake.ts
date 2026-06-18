import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { badRequest, forbidden, ok, serverError } from "../../lib/response.js";
import { getVenueIntake, saveVenueIntake } from "../../onboarding/venue-onboarding-service.js";
import { requireVenueOnboardingRouteContext } from "./venue-onboarding-route-context.js";

export const getHandler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ctx = await requireVenueOnboardingRouteContext(event, "view");
    if ("response" in ctx) return ctx.response;

    const intake = await getVenueIntake(ctx.venueCode);
    return withCorrelationHeaders(event, ok({ intake }));
  } catch (error) {
    console.error("[venue-onboarding-intake-get]", error);
    return withCorrelationHeaders(event, serverError());
  }
};

export const putHandler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ctx = await requireVenueOnboardingRouteContext(event, "manage");
    if ("response" in ctx) return ctx.response;

    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
    }

    try {
      const intake = await saveVenueIntake({
        venueCode: ctx.venueCode,
        agencyId: ctx.agencyId,
        actorId: ctx.user.userId,
        body,
      });
      return withCorrelationHeaders(event, ok({ intake }));
    } catch (error) {
      if (error instanceof Error && error.message === "FORBIDDEN_TENANT") {
        return withCorrelationHeaders(event, forbidden());
      }
      throw error;
    }
  } catch (error) {
    console.error("[venue-onboarding-intake-put]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
