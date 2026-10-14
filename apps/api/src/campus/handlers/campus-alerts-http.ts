/**
 * NexCort iQ Campus Alerts — higher-ed Campus only.
 * Public:
 *   POST /api/public/campus-alerts/verify/start|confirm|renew|register
 * Staff:
 *   GET  /api/campus/{campusCode}/campus-alerts
 *   GET  /api/campus/{campusCode}/campus-alerts/usage
 *   GET  /api/campus/{campusCode}/campus-alerts/renewal-outreach
 *   POST /api/campus/{campusCode}/campus-alerts/expire
 *   POST /api/campus/{campusCode}/campus-alerts/emergency/preview
 *   POST /api/campus/{campusCode}/campus-alerts/emergency/confirm
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ZodError } from "zod";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  jsonStatus,
  notFound,
  serverError,
  serviceUnavailable,
} from "../../lib/response.js";
import { CampusAlertsService } from "../campus-alerts/campus-alerts-service.js";
import { requireCampusRouteContext } from "./campus-route-context.js";

const service = new CampusAlertsService();

function mapError(e: unknown) {
  const msg = e instanceof Error ? e.message : "error";
  const status = (e as Error & { statusCode?: number }).statusCode;
  if (msg === "CAMPUS_ALERTS_DISABLED") return serviceUnavailable("Campus Alerts is not enabled");
  if (msg === "CAMPUS_ALERTS_NOT_AVAILABLE_FOR_TENANT" || msg === "CAMPUS_ALERTS_NOT_ENABLED") {
    return forbidden("Campus Alerts is not available for this campus");
  }
  if (msg.startsWith("FORBIDDEN")) return forbidden(msg.replace(/^FORBIDDEN:?\s*/, "") || "Forbidden");
  if (msg === "RATE_LIMITED") return serviceUnavailable("Rate limit exceeded");
  if (msg === "NOT_FOUND") return notFound();
  if (msg.startsWith("VALIDATION:")) return badRequest(msg.replace(/^VALIDATION:/, ""));
  if (e instanceof ZodError) return badRequestFromZod(e);
  if (status === 403) return forbidden(msg);
  if (status === 404) return notFound();
  if (status === 400 || status === 409) {
    return jsonStatus({ error: msg.replace(/^VALIDATION:/, "") }, status);
  }
  if (status === 429) return serviceUnavailable("Rate limit exceeded");
  console.error("[campus-alerts]", e);
  return serverError();
}

function abuseKey(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  const ip = event.requestContext.http.sourceIp ?? "unknown";
  const ua = event.headers?.["user-agent"] ?? event.headers?.["User-Agent"] ?? "";
  return `${ip}:${ua.slice(0, 64)}`;
}

function parseBody(event: Parameters<APIGatewayProxyHandlerV2>[0]): unknown {
  try {
    return JSON.parse(event.body ?? "{}");
  } catch {
    throw Object.assign(new Error("VALIDATION:Invalid JSON"), { statusCode: 400 });
  }
}

/** Public multi-route handler — path suffix selects action. */
export const publicHandler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const method = event.requestContext.http.method.toUpperCase();
    if (method !== "POST") {
      return withCorrelationHeaders(event, badRequest("Unsupported method"));
    }
    const path = event.rawPath ?? event.requestContext.http.path ?? "";
    const body = parseBody(event);
    const key = abuseKey(event);

    if (path.endsWith("/verify/start")) {
      const result = await service.startVerify(body, key);
      return withCorrelationHeaders(event, jsonStatus(result, 200));
    }
    if (path.endsWith("/verify/confirm")) {
      const result = await service.confirmOtp(body, key);
      return withCorrelationHeaders(event, jsonStatus(result, 200));
    }
    if (path.endsWith("/renew")) {
      const result = await service.renew(body);
      return withCorrelationHeaders(event, jsonStatus(result, 200));
    }
    if (path.endsWith("/register")) {
      const result = await service.register(body);
      return withCorrelationHeaders(event, jsonStatus(result, 201));
    }

    return withCorrelationHeaders(event, badRequest("Unsupported path"));
  } catch (e) {
    return withCorrelationHeaders(event, mapError(e));
  }
};

export const staffHandler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const path = event.rawPath ?? event.requestContext.http.path ?? "";
    const method = event.requestContext.http.method.toUpperCase();
    // Emergency send authorization is enforced in CampusAlertsService (role + classification).
    // Use view-level campus access so CAMPUS_DISPATCH can initiate when policy allows.
    const ctx = await requireCampusRouteContext(event, path.endsWith("/expire") ? "manage" : "view");
    if ("response" in ctx) return ctx.response;

    if (method === "GET" && path.endsWith("/usage")) {
      const usage = await service.listEmergencyUsage(ctx.campusCode, ctx.user);
      return withCorrelationHeaders(event, jsonStatus(usage, 200));
    }

    if (method === "GET" && path.endsWith("/renewal-outreach")) {
      const pack = await service.renewalOutreachPack(ctx.campusCode, ctx.user);
      return withCorrelationHeaders(event, jsonStatus(pack, 200));
    }

    if (method === "GET") {
      const metrics = await service.staffMetrics(ctx.campusCode, ctx.user);
      return withCorrelationHeaders(event, jsonStatus(metrics, 200));
    }

    if (method === "POST" && path.endsWith("/expire")) {
      const result = await service.expireDueSubscriptions(ctx.agencyId);
      return withCorrelationHeaders(event, jsonStatus(result, 200));
    }

    if (method === "POST" && path.endsWith("/emergency/preview")) {
      const result = await service.previewEmergencyBroadcast(
        ctx.campusCode,
        ctx.user,
        parseBody(event),
      );
      return withCorrelationHeaders(event, jsonStatus(result, 200));
    }

    if (method === "POST" && path.endsWith("/emergency/confirm")) {
      const result = await service.confirmEmergencyBroadcast(
        ctx.campusCode,
        ctx.user,
        parseBody(event),
      );
      return withCorrelationHeaders(event, jsonStatus(result, 202));
    }

    return withCorrelationHeaders(event, badRequest("Unsupported method"));
  } catch (e) {
    return withCorrelationHeaders(event, mapError(e));
  }
};

export const handler = publicHandler;
