import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ZodError } from "zod";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  ok,
  serverError,
} from "../../lib/response.js";
import { requireAgencyRoute } from "../vertical/agency-route-context.js";
import {
  handleVisitorCheckIn,
  listVisitors,
  visitorCheckInBodySchema,
} from "../../campus/campus-visitors-service.js";
import {
  getPickupRecord,
  listPickupRecords,
  studentPickupRecordSchema,
  upsertPickupRecord,
} from "../../campus/campus-pickup-service.js";
import { campusRoleFamily, isRcInternalOperator } from "rapid-cortex-shared";

function canManageVisitors(role: string): boolean {
  if (isRcInternalOperator(role)) return true;
  const family = campusRoleFamily(role);
  return family === "admin" || family === "supervisor" || family === "security" || family === "dispatch";
}

function canReadPickup(role: string): boolean {
  if (isRcInternalOperator(role)) return true;
  const family = campusRoleFamily(role);
  return family === "admin" || family === "supervisor" || family === "security";
}

function canWritePickup(role: string): boolean {
  if (isRcInternalOperator(role)) return true;
  return campusRoleFamily(role) === "admin";
}

function pathTail(event: APIGatewayProxyEventV2): string {
  const raw = event.rawPath ?? event.requestContext.http.path ?? "";
  const marker = "/api/campus/";
  const idx = raw.indexOf(marker);
  if (idx < 0) return "";
  const after = raw.slice(idx + marker.length);
  const slash = after.indexOf("/");
  return slash < 0 ? "" : after.slice(slash + 1);
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method.toUpperCase();
  const tail = pathTail(event);

  try {
    if (tail === "visitors" && method === "GET") {
      const ctx = await requireAgencyRoute(event, "campus.dashboard.view");
      if ("response" in ctx) return ctx.response;
      if (!canManageVisitors(ctx.user.role)) {
        return withCorrelationHeaders(event, forbidden());
      }
      const date = event.queryStringParameters?.date ?? undefined;
      const visitors = await listVisitors(ctx.agencyId, date);
      return withCorrelationHeaders(event, ok({ visitors }));
    }

    if (tail === "visitors/check-in" && method === "POST") {
      const ctx = await requireAgencyRoute(event, "campus.dashboard.view");
      if ("response" in ctx) return ctx.response;
      if (!canManageVisitors(ctx.user.role)) {
        return withCorrelationHeaders(event, forbidden());
      }
      let body: unknown = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
      }
      try {
        const parsed = visitorCheckInBodySchema.parse(body);
        const result = await handleVisitorCheckIn(
          ctx.agencyId,
          parsed,
          ctx.user.email ?? ctx.user.userId,
        );
        return withCorrelationHeaders(event, ok(result));
      } catch (error) {
        if (error instanceof ZodError) {
          return withCorrelationHeaders(event, badRequestFromZod(error));
        }
        throw error;
      }
    }

    if (tail === "pickup-auth" && method === "GET") {
      const ctx = await requireAgencyRoute(event, "campus.dashboard.view");
      if ("response" in ctx) return ctx.response;
      if (!canReadPickup(ctx.user.role)) {
        return withCorrelationHeaders(event, forbidden());
      }
      const studentId = event.queryStringParameters?.studentId?.trim();
      if (studentId) {
        const record = await getPickupRecord(ctx.agencyId, studentId);
        return withCorrelationHeaders(event, ok({ record: record ?? null }));
      }
      const records = await listPickupRecords(ctx.agencyId);
      return withCorrelationHeaders(event, ok({ records }));
    }

    if (tail === "pickup-auth" && method === "PUT") {
      const ctx = await requireAgencyRoute(event, "campus.settings.manage");
      if ("response" in ctx) return ctx.response;
      if (!canWritePickup(ctx.user.role)) {
        return withCorrelationHeaders(event, forbidden());
      }
      let body: unknown = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
      }
      try {
        const now = new Date().toISOString();
        const parsed = studentPickupRecordSchema.parse({
          ...(typeof body === "object" && body ? body : {}),
          agencyId: ctx.agencyId,
          updatedAt: now,
          updatedBy: ctx.user.userId,
        });
        await upsertPickupRecord(parsed);
        return withCorrelationHeaders(event, ok({ record: parsed }));
      } catch (error) {
        if (error instanceof ZodError) {
          return withCorrelationHeaders(event, badRequestFromZod(error));
        }
        throw error;
      }
    }

    return withCorrelationHeaders(event, badRequest("Not found"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("CAMPUS_VISITORS_TABLE") || message.includes("CAMPUS_PICKUP_AUTH_TABLE")) {
      console.error("[campus-k12] table env missing", message);
      return withCorrelationHeaders(
        event,
        ok({ error: "K-12 tables not provisioned in this environment" }, 503),
      );
    }
    console.error("[campus-k12]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
