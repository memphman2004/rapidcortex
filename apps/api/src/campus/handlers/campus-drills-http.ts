/**
 * Campus K-12 Safety Drill HTTP handler
 *
 * Routes:
 *   GET  /api/campus/{agencyId}/drills                     - list drills (with optional filter)
 *   POST /api/campus/{agencyId}/drills                     - log a drill
 *   GET  /api/campus/{agencyId}/drills/{drillId}           - get single drill
 *   PATCH /api/campus/{agencyId}/drills/{drillId}          - update drill
 *   GET  /api/campus/{agencyId}/drills/compliance          - compliance summary for a site/year
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  ok,
  serverError,
} from "../../lib/response.js";
import { requireAgencyRoute } from "../../handlers/vertical/agency-route-context.js";
import {
  createDrill,
  getDrill,
  getDrillCompliance,
  isCampusDrillsTableConfigured,
  listDrills,
  updateDrill,
} from "../campus-drills-service.js";
import {
  campusDrillCreateBodySchema,
  campusDrillListQuerySchema,
  campusDrillPatchBodySchema,
  campusRoleFamily,
  getCurrentSchoolYear,
  isRcInternalOperator,
} from "rapid-cortex-shared";

function canReadDrills(role: string): boolean {
  if (isRcInternalOperator(role)) return true;
  const family = campusRoleFamily(role);
  return family === "admin" || family === "supervisor" || family === "security" || family === "dispatch";
}

function canWriteDrills(role: string): boolean {
  if (isRcInternalOperator(role)) return true;
  const family = campusRoleFamily(role);
  return family === "admin" || family === "supervisor";
}

function notProvisioned(event: Parameters<APIGatewayProxyHandlerV2>[0]) {
  return withCorrelationHeaders(
    event,
    ok({ error: "Drill tracking not provisioned in this environment" }, 503),
  );
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method.toUpperCase();
  const rawPath = event.rawPath ?? "";

  // Extract path tail after /api/campus/{agencyId}/drills
  const tailMatch = rawPath.match(/\/api\/campus\/[^/]+\/drills\/?(.*)$/);
  const tail = tailMatch?.[1]?.replace(/\/$/, "") ?? "";

  try {
    if (method === "GET" && tail === "") {
      // GET /drills
      const ctx = await requireAgencyRoute(event, "campus.dashboard.view");
      if ("response" in ctx) return ctx.response;
      if (!canReadDrills(ctx.user.role)) return withCorrelationHeaders(event, forbidden());
      if (!isCampusDrillsTableConfigured()) return notProvisioned(event);

      const qParsed = campusDrillListQuerySchema.safeParse(event.queryStringParameters ?? {});
      const query = qParsed.success ? qParsed.data : {};
      const drills = await listDrills(ctx.agencyId, query);
      return withCorrelationHeaders(event, ok({ drills }));
    }

    if (method === "POST" && tail === "") {
      // POST /drills
      const ctx = await requireAgencyRoute(event, "campus.settings.manage");
      if ("response" in ctx) return ctx.response;
      if (!canWriteDrills(ctx.user.role)) return withCorrelationHeaders(event, forbidden());
      if (!isCampusDrillsTableConfigured()) return notProvisioned(event);

      let body: unknown = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
      }
      const parsed = campusDrillCreateBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));

      const drill = await createDrill({
        agencyId: ctx.agencyId,
        body: parsed.data,
        createdBy: ctx.user.userId,
      });
      return withCorrelationHeaders(event, ok({ drill }));
    }

    if (method === "GET" && tail === "compliance") {
      // GET /drills/compliance?siteId=&schoolYear=
      const ctx = await requireAgencyRoute(event, "campus.dashboard.view");
      if ("response" in ctx) return ctx.response;
      if (!canReadDrills(ctx.user.role)) return withCorrelationHeaders(event, forbidden());
      if (!isCampusDrillsTableConfigured()) return notProvisioned(event);

      const siteId = event.queryStringParameters?.siteId;
      if (!siteId) return withCorrelationHeaders(event, badRequest("siteId required"));
      const schoolYear =
        event.queryStringParameters?.schoolYear ?? getCurrentSchoolYear();

      const summary = await getDrillCompliance(ctx.agencyId, siteId, schoolYear);
      return withCorrelationHeaders(event, ok({ compliance: summary }));
    }

    // /drills/{drillId}
    const drillIdMatch = tail.match(/^([^/]+)$/);
    if (drillIdMatch) {
      const drillId = drillIdMatch[1];

      if (method === "GET") {
        const ctx = await requireAgencyRoute(event, "campus.dashboard.view");
        if ("response" in ctx) return ctx.response;
        if (!canReadDrills(ctx.user.role)) return withCorrelationHeaders(event, forbidden());
        if (!isCampusDrillsTableConfigured()) return notProvisioned(event);

        const schoolYear =
          event.queryStringParameters?.schoolYear ?? getCurrentSchoolYear();
        const drill = await getDrill(ctx.agencyId, drillId, schoolYear);
        if (!drill) return withCorrelationHeaders(event, ok({ drill: null }, 404));
        return withCorrelationHeaders(event, ok({ drill }));
      }

      if (method === "PATCH") {
        const ctx = await requireAgencyRoute(event, "campus.settings.manage");
        if ("response" in ctx) return ctx.response;
        if (!canWriteDrills(ctx.user.role)) return withCorrelationHeaders(event, forbidden());
        if (!isCampusDrillsTableConfigured()) return notProvisioned(event);

        let body: unknown = {};
        try {
          body = event.body ? JSON.parse(event.body) : {};
        } catch {
          return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
        }
        const parsed = campusDrillPatchBodySchema.safeParse(body);
        if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));

        const schoolYear =
          (typeof body === "object" && body && "schoolYear" in body
            ? (body as Record<string, unknown>).schoolYear as string
            : undefined) ?? getCurrentSchoolYear();

        const updated = await updateDrill(
          ctx.agencyId,
          drillId,
          schoolYear,
          parsed.data,
          ctx.user.userId,
        );
        return withCorrelationHeaders(event, ok({ drill: updated }));
      }
    }

    return withCorrelationHeaders(event, badRequest("Not found"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("CAMPUS_DRILLS_TABLE")) {
      return notProvisioned(event);
    }
    console.error("[campus-drills]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
