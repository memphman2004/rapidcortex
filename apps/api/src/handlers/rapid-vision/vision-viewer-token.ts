/**
 * Issues a short-lived KVS WebRTC viewer token for a Rapid Vision™ session.
 * Mirrors ring-stream-viewer-token.ts; substitutes the Vision session table.
 *
 * Route: GET /api/vision/sessions/{sessionId}/viewer-token?incidentId=
 *
 * WebRTC uses kvsChannelName first, then kvsStreamArn as a signaling-name fallback.
 * HLS transcript extraction prefers kvsStreamArn (see transcript worker).
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { canViewVision } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { env } from "../../lib/env.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { isRingAuthorizedRole } from "../../integrations/ring/ring-auth.js";
import { ringJson } from "../../integrations/ring/ring-api-response.js";
import { visionStore } from "../../rapid-vision/store.js";
import { visionWebRtcChannelName } from "../../rapid-vision/kvs-media-ref.js";
import { KvsChannelService } from "../../shared/kvs-channel-service.js";

const kvs = new KvsChannelService();

function sessionIdFromEvent(event: APIGatewayProxyEventV2): string {
  const fromParams = event.pathParameters?.sessionId?.trim() ?? "";
  if (fromParams) return fromParams;
  const path = event.rawPath ?? event.requestContext?.http?.path ?? "";
  const match = path.match(/\/sessions\/([^/]+)\/viewer-token/);
  return match?.[1] ? decodeURIComponent(match[1]).trim() : "";
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const user = await getUserContext(event);
    if (!user) return ringJson({ success: false, error: "Unauthorized" }, 401);
    if (!isUserAccountActive(user)) {
      return ringJson({ success: false, error: ACCOUNT_INACTIVE_MESSAGE }, 403);
    }
    const pwd = operationalPasswordBlock(user);
    if (pwd) {
      return ringJson({ success: false, error: "Password update is required before continuing." }, 403);
    }
    if (!env.enableRapidVision) {
      return ringJson({ success: false, error: "Rapid Vision™ is disabled" }, 503);
    }
    if (!isRingAuthorizedRole(user) && !canViewVision(user, user.agencyId)) {
      return ringJson({ success: false, error: "Forbidden" }, 403);
    }

    const sessionId = sessionIdFromEvent(event);
    const incidentId = event.queryStringParameters?.incidentId?.trim() ?? "";
    if (!sessionId || !incidentId) {
      return ringJson(
        { success: false, error: "sessionId (path) and incidentId (query) are required." },
        400,
      );
    }

    const session = await visionStore.getSession(incidentId, sessionId, user.agencyId);
    if (!session) return ringJson({ success: false, error: "Session not found." }, 404);
    if (session.agencyId !== user.agencyId) {
      return ringJson({ success: false, error: "Forbidden" }, 403);
    }
    if (session.status !== "active") {
      return ringJson({ success: false, error: `Stream is ${session.status}.` }, 409);
    }

    const channelRef = visionWebRtcChannelName(session);
    if (!channelRef) {
      return ringJson({ success: false, error: "Stream bridge not yet ready — retry shortly." }, 409);
    }

    const token = await kvs.issueViewerToken(channelRef);

    return ringJson({
      success: true,
      data: {
        sessionId,
        incidentId,
        cameraId: session.cameraId,
        kvsChannelName: token.channelName,
        channelArn: token.channelArn,
        region: token.region,
        credentials: token.credentials,
        wssEndpoint: token.wssEndpoint,
        iceServers: token.iceServers,
      },
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "vision_viewer_token_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringJson({ success: false, error: "Unable to issue Vision stream viewer token." }, 500);
  }
}
