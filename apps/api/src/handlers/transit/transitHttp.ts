import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
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
import { requireTransitRouteContext } from "./transit-route-context.js";
import * as transit from "../../transit/transit-service.js";

function methodOf(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return (event.requestContext.http?.method ?? "GET").toUpperCase();
}

function rawPathOf(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return event.rawPath ?? "";
}

function match(
  event: Parameters<APIGatewayProxyHandlerV2>[0],
  method: string,
  pattern: RegExp,
): RegExpMatchArray | null {
  if (methodOf(event) !== method) return null;
  const routeKey = event.routeKey ?? "";
  const path = rawPathOf(event);
  return pattern.exec(routeKey.replace(/^[A-Z]+\s+/, "")) ?? pattern.exec(path);
}

function parseJson(event: Parameters<APIGatewayProxyHandlerV2>[0]): unknown {
  if (!event.body) return {};
  return JSON.parse(event.body) as unknown;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const dash = match(event, "GET", /^\/api\/transit\/[^/]+\/dashboard\/?$/);
    if (dash) {
      const ctx = await requireTransitRouteContext(event, "transit.dashboard.view");
      if ("response" in ctx) return ctx.response;
      const data = await transit.getDashboard(ctx.agencyId, ctx.user);
      return withCorrelationHeaders(event, ok(data));
    }

    const listVehicles = match(event, "GET", /^\/api\/transit\/[^/]+\/vehicles\/?$/);
    if (listVehicles) {
      const ctx = await requireTransitRouteContext(event, "transit.fleet.view");
      if ("response" in ctx) return ctx.response;
      const vehicles = await transit.listVehicles(ctx.agencyId, ctx.user);
      return withCorrelationHeaders(event, ok({ vehicles }));
    }

    const createVehicle = match(event, "POST", /^\/api\/transit\/[^/]+\/vehicles\/?$/);
    if (createVehicle) {
      const ctx = await requireTransitRouteContext(event, "transit.fleet.manage");
      if ("response" in ctx) return ctx.response;
      const vehicle = await transit.upsertVehicle(ctx.agencyId, parseJson(event), ctx.user.userId);
      return withCorrelationHeaders(event, ok({ vehicle }, 201));
    }

    const gps = match(event, "POST", /^\/api\/transit\/[^/]+\/vehicles\/[^/]+\/gps\/?$/);
    if (gps) {
      const ctx = await requireTransitRouteContext(event, "transit.fleet.view");
      if ("response" in ctx) return ctx.response;
      const vehicleId = event.pathParameters?.vehicleId?.trim();
      if (!vehicleId) return withCorrelationHeaders(event, badRequest("vehicleId is required"));
      const vehicle = await transit.ingestVehicleGps(
        ctx.agencyId,
        vehicleId,
        parseJson(event),
        ctx.user,
      );
      return withCorrelationHeaders(event, ok({ vehicle }));
    }

    const getVehicle = match(event, "GET", /^\/api\/transit\/[^/]+\/vehicles\/[^/]+\/?$/);
    if (getVehicle) {
      const ctx = await requireTransitRouteContext(event, "transit.fleet.view");
      if ("response" in ctx) return ctx.response;
      const vehicleId = event.pathParameters?.vehicleId?.trim();
      if (!vehicleId) return withCorrelationHeaders(event, badRequest("vehicleId is required"));
      const vehicle = await transit.getVehicle(ctx.agencyId, vehicleId, ctx.user);
      if (!vehicle) return withCorrelationHeaders(event, notFound());
      return withCorrelationHeaders(event, ok({ vehicle }));
    }

    const putVehicle = match(event, "PUT", /^\/api\/transit\/[^/]+\/vehicles\/[^/]+\/?$/);
    if (putVehicle) {
      const ctx = await requireTransitRouteContext(event, "transit.fleet.manage");
      if ("response" in ctx) return ctx.response;
      const vehicle = await transit.upsertVehicle(ctx.agencyId, parseJson(event), ctx.user.userId);
      return withCorrelationHeaders(event, ok({ vehicle }));
    }

    const listRoutes = match(event, "GET", /^\/api\/transit\/[^/]+\/routes\/?$/);
    if (listRoutes) {
      const ctx = await requireTransitRouteContext(event, "transit.routes.view");
      if ("response" in ctx) return ctx.response;
      const routes = await transit.listRoutes(ctx.agencyId);
      return withCorrelationHeaders(event, ok({ routes }));
    }

    const putRoute = match(event, "POST", /^\/api\/transit\/[^/]+\/routes\/?$/)
      || match(event, "PUT", /^\/api\/transit\/[^/]+\/routes\/[^/]+\/?$/);
    if (putRoute) {
      const ctx = await requireTransitRouteContext(event, "transit.routes.manage");
      if ("response" in ctx) return ctx.response;
      const route = await transit.upsertRoute(ctx.agencyId, parseJson(event));
      return withCorrelationHeaders(event, ok({ route }));
    }

    const listStations = match(event, "GET", /^\/api\/transit\/[^/]+\/stations\/?$/);
    if (listStations) {
      const ctx = await requireTransitRouteContext(event, "transit.routes.view");
      if ("response" in ctx) return ctx.response;
      const stations = await transit.listStations(ctx.agencyId);
      return withCorrelationHeaders(event, ok({ stations }));
    }

    const putStation = match(event, "POST", /^\/api\/transit\/[^/]+\/stations\/?$/)
      || match(event, "PUT", /^\/api\/transit\/[^/]+\/stations\/[^/]+\/?$/);
    if (putStation) {
      const ctx = await requireTransitRouteContext(event, "transit.routes.manage");
      if ("response" in ctx) return ctx.response;
      const station = await transit.upsertStation(ctx.agencyId, parseJson(event));
      return withCorrelationHeaders(event, ok({ station }));
    }

    const listOperators = match(event, "GET", /^\/api\/transit\/[^/]+\/operators\/?$/);
    if (listOperators) {
      const ctx = await requireTransitRouteContext(event, "transit.operators.view");
      if ("response" in ctx) return ctx.response;
      const operators = await transit.listOperators(ctx.agencyId);
      return withCorrelationHeaders(event, ok({ operators }));
    }

    const putOperator = match(event, "POST", /^\/api\/transit\/[^/]+\/operators\/?$/)
      || match(event, "PUT", /^\/api\/transit\/[^/]+\/operators\/[^/]+\/?$/);
    if (putOperator) {
      const ctx = await requireTransitRouteContext(event, "transit.operators.manage");
      if ("response" in ctx) return ctx.response;
      const operator = await transit.upsertOperator(ctx.agencyId, parseJson(event));
      return withCorrelationHeaders(event, ok({ operator }));
    }

    const listIncidents = match(event, "GET", /^\/api\/transit\/[^/]+\/incidents\/?$/);
    if (listIncidents) {
      const ctx = await requireTransitRouteContext(event, "transit.incidents.view");
      if ("response" in ctx) return ctx.response;
      const incidents = await transit.listIncidents(ctx.agencyId);
      return withCorrelationHeaders(event, ok({ incidents }));
    }

    const createIncident = match(event, "POST", /^\/api\/transit\/[^/]+\/incidents\/?$/);
    if (createIncident) {
      const ctx = await requireTransitRouteContext(event, "transit.incidents.create");
      if ("response" in ctx) return ctx.response;
      const incident = await transit.createIncident(ctx.agencyId, parseJson(event), ctx.user);
      return withCorrelationHeaders(event, ok({ incident }, 201));
    }

    const patchIncident = match(event, "PUT", /^\/api\/transit\/[^/]+\/incidents\/[^/]+\/?$/);
    if (patchIncident) {
      const ctx = await requireTransitRouteContext(event, "transit.incidents.update");
      if ("response" in ctx) return ctx.response;
      const incidentId = event.pathParameters?.incidentId?.trim();
      if (!incidentId) return withCorrelationHeaders(event, badRequest("incidentId is required"));
      const body = parseJson(event) as { escalatedTo911?: boolean };
      const permission =
        body.escalatedTo911 === true ? "transit.incidents.escalate" : "transit.incidents.update";
      if (permission === "transit.incidents.escalate") {
        const esc = await requireTransitRouteContext(event, permission);
        if ("response" in esc) return esc.response;
      }
      const incident = await transit.patchIncident(ctx.agencyId, incidentId, body, ctx.user);
      return withCorrelationHeaders(event, ok({ incident }));
    }

    const listReports = match(event, "GET", /^\/api\/transit\/[^/]+\/reports\/?$/);
    if (listReports) {
      const ctx = await requireTransitRouteContext(event, "transit.reports.view");
      if ("response" in ctx) return ctx.response;
      const reports = await transit.listReports(ctx.agencyId);
      return withCorrelationHeaders(event, ok({ reports }));
    }

    const broadcast = match(event, "POST", /^\/api\/transit\/[^/]+\/broadcast\/?$/);
    if (broadcast) {
      const ctx = await requireTransitRouteContext(event, "transit.broadcast.send");
      if ("response" in ctx) return ctx.response;
      const result = await transit.sendBroadcast(ctx.agencyId, parseJson(event), ctx.user);
      return withCorrelationHeaders(event, ok(result, 201));
    }

    const getAlert = match(event, "GET", /^\/api\/transit\/[^/]+\/alert-level\/?$/);
    if (getAlert) {
      const ctx = await requireTransitRouteContext(event, "transit.dashboard.view");
      if ("response" in ctx) return ctx.response;
      const alert = await transit.getAlertLevel(ctx.agencyId);
      return withCorrelationHeaders(event, ok({ alert }));
    }

    const putAlert = match(event, "PUT", /^\/api\/transit\/[^/]+\/alert-level\/?$/);
    if (putAlert) {
      const ctx = await requireTransitRouteContext(event, "transit.alert.manage");
      if ("response" in ctx) return ctx.response;
      const alert = await transit.setAlertLevel(ctx.agencyId, parseJson(event), ctx.user);
      return withCorrelationHeaders(event, ok({ alert }));
    }

    return withCorrelationHeaders(event, notFound());
  } catch (error) {
    if (error instanceof ZodError) {
      return withCorrelationHeaders(event, badRequestFromZod(error));
    }
    if (error instanceof SyntaxError) {
      return withCorrelationHeaders(event, badRequest("Invalid JSON"));
    }
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN_PERMISSION" || error.message === "FORBIDDEN_TENANT") {
        return withCorrelationHeaders(event, forbidden());
      }
      if (error.message === "NOT_FOUND" || (error as Error & { statusCode?: number }).statusCode === 404) {
        return withCorrelationHeaders(event, notFound());
      }
    }
    return withCorrelationHeaders(event, serverError());
  }
};
