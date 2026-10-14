/**
 * Escort iQ™ HTTP — higher-ed Campus only.
 * Public: POST /api/public/escort-iq  GET /api/public/escort-iq/{token}
 * Staff:  GET /api/campus/{campusCode}/escort-iq
 *         GET /api/campus/{campusCode}/escort-iq/{escortId}
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
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
import { ZodError } from "zod";
import { EscortIqService } from "../escort-iq/escort-iq-service.js";
import { requireCampusRouteContext } from "./campus-route-context.js";

const service = new EscortIqService();

function mapError(e: unknown) {
  const msg = e instanceof Error ? e.message : "error";
  const status = (e as Error & { statusCode?: number }).statusCode;
  if (msg === "ESCORT_IQ_DISABLED") return serviceUnavailable("Escort iQ is not enabled");
  if (msg === "ESCORT_IQ_NOT_AVAILABLE_FOR_TENANT" || msg === "ESCORT_IQ_NOT_ENABLED") {
    return forbidden("Escort iQ is not available for this campus");
  }
  if (msg === "NOT_FOUND") return notFound();
  if (msg.startsWith("VALIDATION:")) return badRequest(msg.replace(/^VALIDATION:/, ""));
  if (e instanceof ZodError) return badRequestFromZod(e);
  if (status === 403) return forbidden(msg);
  if (status === 404) return notFound();
  if (status === 400) return badRequest(msg);
  console.error("[escort-iq]", e);
  return serverError();
}

export const publicHandler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const method = event.requestContext.http.method.toUpperCase();
    const token = event.pathParameters?.token?.trim();

    if (method === "POST") {
      let body: unknown;
      try {
        body = JSON.parse(event.body ?? "{}");
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      }
      const created = await service.createPublicSession(body);
      return withCorrelationHeaders(
        event,
        jsonStatus(
          {
            ...created.session,
            publicToken: created.publicToken,
            ...(created.trackingToken ? { trackingToken: created.trackingToken } : {}),
          },
          201,
        ),
      );
    }

    if (method === "GET" && token) {
      const session = await service.getPublicByToken(token);
      return withCorrelationHeaders(event, jsonStatus(session, 200));
    }

    return withCorrelationHeaders(event, badRequest("Unsupported method"));
  } catch (e) {
    return withCorrelationHeaders(event, mapError(e));
  }
};

export const staffHandler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ctx = await requireCampusRouteContext(event, "view");
    if ("response" in ctx) return ctx.response;

    const method = event.requestContext.http.method.toUpperCase();
    const escortId = event.pathParameters?.escortId?.trim();

    if (method === "GET" && escortId) {
      const session = await service.getForStaff(ctx.campusCode, escortId, ctx.user);
      return withCorrelationHeaders(event, jsonStatus(session, 200));
    }

    if (method === "GET") {
      const items = await service.listForCampus(ctx.campusCode, ctx.user);
      return withCorrelationHeaders(event, jsonStatus({ items }, 200));
    }

    return withCorrelationHeaders(event, badRequest("Unsupported method"));
  } catch (e) {
    return withCorrelationHeaders(event, mapError(e));
  }
};

/** SAM may bind a single export named `handler` for public routes. */
export const handler = publicHandler;
