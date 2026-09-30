import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ZodError } from "zod";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
} from "../../lib/response.js";
import { requireAgencyRoute } from "../vertical/agency-route-context.js";
import {
  createCampusZone,
  deleteCampusZone,
  listCampusZonesForAgency,
  updateCampusZone,
} from "../../campus/campus-zones-service.js";

function zoneIdFromPath(event: APIGatewayProxyEventV2): string {
  const raw =
    event.pathParameters?.zoneId ??
    event.pathParameters?.zoneCode ??
    event.pathParameters?.proxy ??
    "";
  return decodeURIComponent(String(raw).trim());
}

async function getHandler(event: APIGatewayProxyEventV2) {
  try {
    const ctx = await requireAgencyRoute(event, "campus.dashboard.view");
    if ("response" in ctx) return ctx.response;
    const data = await listCampusZonesForAgency(ctx.agencyId);
    return withCorrelationHeaders(event, ok(data));
  } catch (error) {
    console.error("[campus-zones-get]", error);
    return withCorrelationHeaders(event, serverError());
  }
}

async function postHandler(event: APIGatewayProxyEventV2) {
  try {
    const ctx = await requireAgencyRoute(event, "campus.zones.manage");
    if ("response" in ctx) return ctx.response;
    let body: unknown = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
    }
    try {
      const zone = await createCampusZone({
        agencyId: ctx.agencyId,
        actorId: ctx.user.userId,
        body,
      });
      return withCorrelationHeaders(event, ok({ zone }, 201));
    } catch (error) {
      if (error instanceof ZodError) {
        return withCorrelationHeaders(event, badRequestFromZod(error));
      }
      if (error instanceof Error && error.message === "UNKNOWN_SITE") {
        return withCorrelationHeaders(event, badRequest("Unknown school / campus site"));
      }
      if (error instanceof Error && error.message === "ZONE_EXISTS") {
        return withCorrelationHeaders(event, badRequest("A zone with that name already exists"));
      }
      throw error;
    }
  } catch (error) {
    console.error("[campus-zones-post]", error);
    return withCorrelationHeaders(event, serverError());
  }
}

async function patchHandler(event: APIGatewayProxyEventV2) {
  try {
    const ctx = await requireAgencyRoute(event, "campus.zones.manage");
    if ("response" in ctx) return ctx.response;
    const zoneId = zoneIdFromPath(event);
    if (!zoneId) return withCorrelationHeaders(event, badRequest("zoneId is required"));

    let body: unknown = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
    }

    try {
      const zone = await updateCampusZone({
        agencyId: ctx.agencyId,
        actorId: ctx.user.userId,
        zoneId,
        body,
      });
      return withCorrelationHeaders(event, ok({ zone }));
    } catch (error) {
      if (error instanceof ZodError) {
        return withCorrelationHeaders(event, badRequestFromZod(error));
      }
      if (error instanceof Error && error.message === "NOT_FOUND") {
        return withCorrelationHeaders(event, notFound("Zone not found"));
      }
      if (error instanceof Error && error.message === "FORBIDDEN_TENANT") {
        return withCorrelationHeaders(event, forbidden());
      }
      throw error;
    }
  } catch (error) {
    console.error("[campus-zones-patch]", error);
    return withCorrelationHeaders(event, serverError());
  }
}

async function deleteHandler(event: APIGatewayProxyEventV2) {
  try {
    const ctx = await requireAgencyRoute(event, "campus.zones.manage");
    if ("response" in ctx) return ctx.response;
    const zoneId = zoneIdFromPath(event);
    if (!zoneId) return withCorrelationHeaders(event, badRequest("zoneId is required"));

    try {
      const result = await deleteCampusZone({
        agencyId: ctx.agencyId,
        actorId: ctx.user.userId,
        zoneId,
      });
      return withCorrelationHeaders(event, ok(result));
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") {
        return withCorrelationHeaders(event, notFound("Zone not found"));
      }
      if (error instanceof Error && error.message === "FORBIDDEN_TENANT") {
        return withCorrelationHeaders(event, forbidden());
      }
      throw error;
    }
  } catch (error) {
    console.error("[campus-zones-delete]", error);
    return withCorrelationHeaders(event, serverError());
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method.toUpperCase();
  if (method === "GET") return getHandler(event);
  if (method === "POST") return postHandler(event);
  if (method === "PATCH") return patchHandler(event);
  if (method === "DELETE") return deleteHandler(event);
  return withCorrelationHeaders(event, badRequest("Method not allowed"));
};
