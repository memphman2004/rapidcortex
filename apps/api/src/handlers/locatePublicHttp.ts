import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { isLikelyPublicAccessToken } from "../lib/publicToken.js";
import {
  badRequest,
  jsonStatus,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
} from "../lib/response.js";
import { smsLocationService } from "../services/smsLocationService.js";

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith("VALIDATION:")) return badRequest(msg.slice("VALIDATION:".length));
  if (msg === "NOT_FOUND") return notFound();
  if (msg === "LOCATION_TOKENS_TABLE_NOT_CONFIGURED") return serviceUnavailable("Location sharing is not available");
  if (msg === "EXPIRED") return jsonStatus({ error: "token_expired" }, 410);
  if (msg === "ALREADY_USED") return jsonStatus({ error: "already_shared" }, 409);
  if (msg === "RATE_LIMITED") return jsonStatus({ error: "rate_limited" }, 429);
  if (msg === "MISSING_PUBLIC_BASE_URL") return badRequest("Public app URL is not configured.");
  return serverError();
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const routeKey = event.routeKey ?? "";
    const token = event.pathParameters?.token;
    if (!isLikelyPublicAccessToken(token)) return notFound("Missing token");

    if (routeKey === "GET /api/public/locate/{token}") {
      const view = await smsLocationService.getPublicToken(token!);
      return ok(view);
    }

    if (routeKey === "POST /api/public/locate/{token}") {
      const body = JSON.parse(event.body ?? "{}");
      const result = await smsLocationService.submitLocation(token!, body);
      return ok(result);
    }

    return notFound("Unknown route");
  } catch (e) {
    return mapErr(e);
  }
};
