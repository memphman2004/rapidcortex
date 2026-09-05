import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ZodError } from "zod";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { badRequest, badRequestFromZod, forbidden, ok, serverError } from "../../lib/response.js";
import { campusCodeFromAgencyId } from "../vertical/agency-id.js";
import { requireAgencyRoute } from "../vertical/agency-route-context.js";
import {
  getCampusSitesForAgency,
  saveCampusSites,
} from "../../campus/campus-sites-service.js";

export const getHandler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ctx = await requireAgencyRoute(event, "campus.dashboard.view");
    if ("response" in ctx) return ctx.response;
    const data = await getCampusSitesForAgency(ctx.agencyId);
    return withCorrelationHeaders(event, ok(data));
  } catch (error) {
    console.error("[campus-sites-get]", error);
    return withCorrelationHeaders(event, serverError());
  }
};

export const putHandler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ctx = await requireAgencyRoute(event, "campus.settings.manage");
    if ("response" in ctx) return ctx.response;

    let body: unknown = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
    }

    try {
      const data = await saveCampusSites({
        campusCode: campusCodeFromAgencyId(ctx.agencyId),
        agencyId: ctx.agencyId,
        actorId: ctx.user.userId,
        body,
      });
      return withCorrelationHeaders(event, ok(data));
    } catch (error) {
      if (error instanceof ZodError) {
        return withCorrelationHeaders(event, badRequestFromZod(error));
      }
      if (error instanceof Error && error.message === "FORBIDDEN_TENANT") {
        return withCorrelationHeaders(event, forbidden());
      }
      throw error;
    }
  } catch (error) {
    console.error("[campus-sites-put]", error);
    return withCorrelationHeaders(event, serverError());
  }
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method.toUpperCase();
  if (method === "GET") return getHandler(event);
  if (method === "PUT") return putHandler(event);
  return withCorrelationHeaders(event, badRequest("Method not allowed"));
};
