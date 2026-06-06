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
import { SilentTextService } from "../services/silentTextService.js";

const service = new SilentTextService();

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith("VALIDATION:")) return badRequest(msg.slice("VALIDATION:".length));
  if (msg === "NOT_FOUND") return notFound();
  if (msg === "SILENT_TEXT_TABLE_NOT_CONFIGURED")
    return serviceUnavailable("Silent text is not configured");
  if (msg === "SESSION_EXPIRED") return jsonStatus({ error: "session_expired" }, 410);
  if (msg === "SESSION_CANCELED" || msg === "SESSION_ENDED")
    return jsonStatus({ error: "session_closed" }, 409);
  return serverError();
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const routeKey = event.routeKey ?? "";
    const token = event.pathParameters?.token;
    if (!isLikelyPublicAccessToken(token)) return notFound("Missing token");

    if (routeKey === "GET /api/silent-text/t/{token}") {
      const s = await service.getPublicByToken(token);
      return ok(s);
    }

    if (routeKey === "GET /api/silent-text/t/{token}/messages") {
      const s = await service.getPublicMessages(token);
      return ok(s);
    }

    if (routeKey === "POST /api/silent-text/t/{token}/opened") {
      const s = await service.recordOpened(token);
      return ok(s);
    }

    if (routeKey === "POST /api/silent-text/t/{token}/presence") {
      const body = JSON.parse(event.body ?? "{}");
      const s = await service.recordPresence(token, body);
      return ok(s);
    }

    if (routeKey === "POST /api/silent-text/t/{token}/message") {
      const body = JSON.parse(event.body ?? "{}");
      const s = await service.postCallerMessage(token, body);
      return ok(s);
    }

    if (routeKey === "POST /api/silent-text/t/{token}/end") {
      const s = await service.endCaller(token);
      return ok(s);
    }

    return notFound("Unknown route");
  } catch (e) {
    return mapErr(e);
  }
};
