import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { notFound } from "../../lib/response.js";
import { joinLiveSessionHandler } from "./joinLiveSession.js";
import { liveHeartbeatCallerHandler } from "./liveHeartbeat.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const routeKey = event.routeKey ?? "";
  if (routeKey === "POST /api/media/live/{token}/join") {
    return joinLiveSessionHandler(event);
  }
  if (routeKey === "POST /api/media/live/{token}/heartbeat") {
    return liveHeartbeatCallerHandler(event);
  }
  return notFound();
};
