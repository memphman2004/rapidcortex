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
import { VideoAssistService } from "../services/videoAssistService.js";

const service = new VideoAssistService();

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith("VALIDATION:")) return badRequest(msg.slice("VALIDATION:".length));
  if (msg === "NOT_FOUND") return notFound();
  if (msg === "VIDEO_ASSIST_TABLE_NOT_CONFIGURED")
    return serviceUnavailable("Video assist is not configured");
  if (msg === "SESSION_EXPIRED") return jsonStatus({ error: "session_expired" }, 410);
  if (msg === "SESSION_CANCELED" || msg === "SESSION_ENDED")
    return jsonStatus({ error: "session_closed" }, 409);
  if (msg === "FORBIDDEN_SIGNAL") return badRequest("Invalid signal");
  return serverError();
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const routeKey = event.routeKey ?? "";
    const token = event.pathParameters?.token;
    if (!isLikelyPublicAccessToken(token)) return notFound("Missing token");

    if (routeKey === "GET /api/video-assist/t/{token}") {
      const s = await service.getPublicByToken(token);
      return ok(s);
    }

    if (routeKey === "GET /api/video-assist/t/{token}/ice-config") {
      return ok(service.iceServers());
    }

    if (routeKey === "POST /api/video-assist/t/{token}/opened") {
      const s = await service.recordOpened(token);
      return ok(s);
    }

    if (routeKey === "POST /api/video-assist/t/{token}/consent") {
      const body = JSON.parse(event.body ?? "{}");
      const s = await service.recordConsent(token, body);
      return ok(s);
    }

    if (routeKey === "POST /api/video-assist/t/{token}/signal") {
      const body = JSON.parse(event.body ?? "{}");
      const s = await service.postCallerSignal(token, body);
      return ok(s);
    }

    if (routeKey === "POST /api/video-assist/t/{token}/end") {
      const s = await service.endCaller(token);
      return ok(s);
    }

    return notFound("Unknown route");
  } catch (e) {
    return mapErr(e);
  }
};
