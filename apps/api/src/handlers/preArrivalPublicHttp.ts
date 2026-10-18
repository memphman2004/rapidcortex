import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { completePreArrivalStepBodySchema } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import {
  badRequest,
  jsonStatus,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
} from "../lib/response.js";
import {
  confirmCallerMedia,
  issueCallerMediaUpload,
  listPublicChannel,
  postCallerChannel,
} from "../pre-arrival/caller-channel-service.js";
import { preArrivalService } from "../pre-arrival/preArrivalService.js";

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "NOT_FOUND") return notFound();
  if (msg === "PRE_ARRIVAL_DISABLED") return serviceUnavailable("Pre-Arrival iQ is not enabled");
  if (msg === "PRE_ARRIVAL_TABLE_NOT_CONFIGURED")
    return serviceUnavailable("Pre-Arrival iQ is not configured");
  if (msg === "SESSION_EXPIRED") return jsonStatus({ error: "session_expired" }, 410);
  if (msg === "SESSION_ENDED") return jsonStatus({ error: "session_closed" }, 409);
  if (msg === "CHANNEL_NOT_AVAILABLE") return jsonStatus({ error: "channel_not_available" }, 403);
  if (msg.startsWith("VALIDATION:")) return badRequest(msg.slice("VALIDATION:".length));
  return serverError();
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enablePreArrivalIq) return serviceUnavailable("Pre-Arrival iQ is not enabled");

    const routeKey = event.routeKey ?? "";
    const token = event.pathParameters?.token;
    if (!token) return notFound("Missing token");

    if (routeKey === "GET /api/public/pre-arrival/{token}") {
      const view = await preArrivalService.getPublic(token);
      return ok(view);
    }

    if (routeKey === "GET /api/public/pre-arrival/{token}/channel") {
      return ok({ messages: await listPublicChannel(token) });
    }

    if (routeKey === "POST /api/public/pre-arrival/{token}/channel") {
      const item = await postCallerChannel(token, JSON.parse(event.body ?? "{}"));
      return ok(item, 201);
    }

    if (routeKey === "POST /api/public/pre-arrival/{token}/channel/upload-url") {
      return ok(await issueCallerMediaUpload(token, JSON.parse(event.body ?? "{}")));
    }

    if (routeKey === "POST /api/public/pre-arrival/{token}/channel/confirm") {
      return ok(await confirmCallerMedia(token, JSON.parse(event.body ?? "{}")));
    }

    if (routeKey === "POST /api/public/pre-arrival/{token}/steps/complete") {
      const parsed = completePreArrivalStepBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequest(parsed.error.message);
      const view = await preArrivalService.completeStep(token, parsed.data.stepId);
      return ok(view);
    }

    return notFound("Unknown route");
  } catch (e) {
    return mapErr(e);
  }
};
