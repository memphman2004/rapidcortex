import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { notFound } from "../../lib/response.js";
import { endLiveSessionHandler } from "./endLiveSession.js";
import { getRecordedPlaybackHandler } from "./getRecordedPlayback.js";
import { getLiveSessionHandler } from "./getLiveSession.js";
import { joinIncidentLiveVideoHandler } from "./joinIncidentLiveVideo.js";
import { liveHeartbeatDispatcherHandler } from "./liveHeartbeat.js";
import { requestLiveVideoHandler } from "./requestLiveVideo.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const routeKey = event.routeKey ?? "";
  if (routeKey === "POST /api/incidents/{id}/live-video/request") {
    return requestLiveVideoHandler(event);
  }
  if (routeKey === "GET /api/incidents/{id}/live-video") {
    return getLiveSessionHandler(event);
  }
  if (routeKey === "POST /api/incidents/{id}/live-video/join") {
    return joinIncidentLiveVideoHandler(event);
  }
  if (routeKey === "GET /api/incidents/{id}/live-video/playback") {
    return getRecordedPlaybackHandler(event);
  }
  if (routeKey === "POST /api/incidents/{id}/live-video/end") {
    return endLiveSessionHandler(event);
  }
  if (routeKey === "POST /api/incidents/{id}/live-video/heartbeat") {
    return liveHeartbeatDispatcherHandler(event);
  }
  return notFound();
};
