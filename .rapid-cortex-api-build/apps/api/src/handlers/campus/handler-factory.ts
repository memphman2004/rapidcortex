import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { badRequest, forbidden, ok, serverError } from "../../lib/response.js";
import {
  canSupervisorCampusOps,
  requireAgencyRoute,
} from "../vertical/agency-route-context.js";

export function campusGetHandler(
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
      console.error("[campus-get]", error);
      return withCorrelationHeaders(event, serverError());
    }
  };
}

export function campusSupervisorPostHandler(
  load: (agencyId: string, actorId: string, body: unknown) => Promise<unknown>,
  responseKey: string,
): APIGatewayProxyHandlerV2 {
  return async (event) => {
    try {
      const ctx = await requireAgencyRoute(event, "campus.dashboard.view");
      if ("response" in ctx) return ctx.response;
      if (!canSupervisorCampusOps(ctx.user)) {
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
      if (error instanceof Error && error.message === "RATE_LIMIT") {
        const cooldown = (error as Error & { cooldownSeconds?: number }).cooldownSeconds ?? 3600;
        return withCorrelationHeaders(
          event,
          ok({ error: "Rate limit exceeded", cooldownSeconds: cooldown }, 429),
        );
      }
      console.error("[campus-post]", error);
      return withCorrelationHeaders(event, serverError());
    }
  };
}

export function campusSupervisorPatchHandler(
  load: (agencyId: string, actorId: string, body: unknown) => Promise<unknown>,
): APIGatewayProxyHandlerV2 {
  return async (event) => {
    try {
      const ctx = await requireAgencyRoute(event, "campus.dashboard.view");
      if ("response" in ctx) return ctx.response;
      if (!canSupervisorCampusOps(ctx.user)) {
        return withCorrelationHeaders(event, forbidden());
      }
      let body: unknown = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
      }
      const data = await load(ctx.agencyId, ctx.user.userId, body);
      return withCorrelationHeaders(event, ok(data));
    } catch (error) {
      console.error("[campus-patch]", error);
      return withCorrelationHeaders(event, serverError());
    }
  };
}
