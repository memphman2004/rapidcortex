import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { badRequest, forbidden, ok, serverError } from "../../lib/response.js";
import {
  canSupervisorVenueOps,
  requireAgencyRoute,
} from "../vertical/agency-route-context.js";

export function venueGetHandler(
  permission: string,
  load: (agencyId: string) => Promise<unknown>,
  responseKey?: string,
): APIGatewayProxyHandlerV2 {
  return async (event) => {
    try {
      const ctx = await requireAgencyRoute(event, permission);
      if ("response" in ctx) return ctx.response;
      const data = await load(ctx.agencyId);
      return withCorrelationHeaders(
        event,
        ok(responseKey ? { [responseKey]: data } : data),
      );
    } catch (error) {
      console.error("[venue-get]", error);
      return withCorrelationHeaders(event, serverError());
    }
  };
}

export function venueSupervisorPostHandler(
  load: (agencyId: string, actorId: string, body: unknown) => Promise<unknown>,
  responseKey: string,
): APIGatewayProxyHandlerV2 {
  return async (event) => {
    try {
      const ctx = await requireAgencyRoute(event, "venue.dashboard.view");
      if ("response" in ctx) return ctx.response;
      if (!canSupervisorVenueOps(ctx.user)) {
        return withCorrelationHeaders(event, forbidden());
      }
      let body: unknown = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
      }
      const data = await load(ctx.agencyId, ctx.user.userId, body);
      return withCorrelationHeaders(event, ok({ [responseKey]: data }));
    } catch (error) {
      console.error("[venue-post]", error);
      return withCorrelationHeaders(event, serverError());
    }
  };
}
