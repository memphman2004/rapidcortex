import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { isLikelyPublicAccessToken } from "../lib/publicToken.js";
import { badRequest, jsonStatus, notFound, ok, serverError, serviceUnavailable } from "../lib/response.js";
import { PinpointService } from "../services/pinpointService.js";

const service = new PinpointService();

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith("VALIDATION:")) return badRequest(msg.slice("VALIDATION:".length));
  if (msg === "NOT_FOUND") return notFound();
  if (msg === "PINPOINT_LINKS_TABLE_NOT_CONFIGURED" || msg === "PINPOINT_DISABLED")
    return serviceUnavailable("Pinpoint is not available");
  if (msg === "SESSION_EXPIRED") return jsonStatus({ error: "link_expired" }, 410);
  if (msg === "MISSING_PUBLIC_BASE_URL") return badRequest("Public app URL is not configured for Pinpoint SMS links.");
  return serverError();
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const routeKey = event.routeKey ?? "";
    const token = event.pathParameters?.token;
    if (!isLikelyPublicAccessToken(token)) return notFound("Missing token");

    if (routeKey === "GET /api/pinpoint/t/{token}") {
      const s = await service.getPublicByToken(token!);
      return ok(s);
    }

    if (routeKey === "POST /api/pinpoint/t/{token}/location") {
      const body = JSON.parse(event.body ?? "{}");
      const s = await service.captureLocation(token!, body);
      return ok(s);
    }

    return notFound("Unknown route");
  } catch (e) {
    return mapErr(e);
  }
};
