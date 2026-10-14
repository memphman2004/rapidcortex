import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { isLikelyPublicAccessToken } from "../lib/publicToken.js";
import { badRequest, jsonStatus, notFound, ok, serverError, serviceUnavailable } from "../lib/response.js";
import { PinpointService } from "../services/pinpointService.js";

const service = new PinpointService();

const PUBLIC_NO_STORE = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
} as const;

function withPublicHeaders(res: APIGatewayProxyResultV2): APIGatewayProxyResultV2 {
  if (typeof res === "string") return res;
  return {
    ...res,
    headers: {
      ...(res.headers ?? {}),
      ...PUBLIC_NO_STORE,
    },
  };
}

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith("VALIDATION:")) return withPublicHeaders(badRequest(msg.slice("VALIDATION:".length)));
  if (msg === "NOT_FOUND") return withPublicHeaders(notFound());
  if (msg === "PINPOINT_LINKS_TABLE_NOT_CONFIGURED" || msg === "PINPOINT_DISABLED")
    return withPublicHeaders(serviceUnavailable("Pinpoint is not available"));
  if (msg === "SESSION_EXPIRED") return withPublicHeaders(jsonStatus({ error: "link_expired" }, 410));
  if (msg === "SESSION_REVOKED") return withPublicHeaders(jsonStatus({ error: "link_revoked" }, 410));
  if (msg === "MISSING_PUBLIC_BASE_URL")
    return withPublicHeaders(badRequest("Public app URL is not configured for Pinpoint SMS links."));
  return withPublicHeaders(serverError());
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const routeKey = event.routeKey ?? "";
    const token = event.pathParameters?.token;
    if (!isLikelyPublicAccessToken(token)) return withPublicHeaders(notFound("Missing token"));

    if (routeKey === "GET /api/pinpoint/t/{token}") {
      const s = await service.getPublicByToken(token!);
      return withPublicHeaders(ok(s));
    }

    if (routeKey === "POST /api/pinpoint/t/{token}/location") {
      const body = JSON.parse(event.body ?? "{}");
      const s = await service.captureLocation(token!, body);
      return withPublicHeaders(ok(s));
    }

    if (routeKey === "POST /api/pinpoint/t/{token}/revoke") {
      let body: unknown = {};
      if (event.body?.trim()) {
        try {
          body = JSON.parse(event.body);
        } catch {
          return withPublicHeaders(badRequest("Invalid JSON"));
        }
      }
      const s = await service.revokeByToken(token!, body);
      return withPublicHeaders(ok(s));
    }

    return withPublicHeaders(notFound("Unknown route"));
  } catch (e) {
    return mapErr(e);
  }
};
