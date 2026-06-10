import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { RingEmergencyRepository } from "../../repositories/ringEmergencyRepository.js";
import { KvsChannelService } from "../../shared/kvs-channel-service.js";
import { isRingAuthorizedRole } from "./ring-auth.js";
import { ringJson } from "./ring-api-response.js";
import { configureRingEmergencyTables } from "./ring-tables.js";

const emergencyRepo = new RingEmergencyRepository();
const kvs = new KvsChannelService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    configureRingEmergencyTables();

    const user = await getUserContext(event);
    if (!user) return ringJson({ success: false, error: "Unauthorized" }, 401);
    if (!isUserAccountActive(user)) {
      return ringJson({ success: false, error: ACCOUNT_INACTIVE_MESSAGE }, 403);
    }
    const pwd = operationalPasswordBlock(user);
    if (pwd) {
      return ringJson({ success: false, error: "Password update is required before continuing." }, 403);
    }
    if (!isRingAuthorizedRole(user)) {
      return ringJson({ success: false, error: "Forbidden" }, 403);
    }

    const sessionId = event.queryStringParameters?.sessionId?.trim() ?? "";
    if (!sessionId) {
      return ringJson({ success: false, error: "sessionId is required." }, 400);
    }

    const session = await emergencyRepo.getSessionById(sessionId);
    if (!session) {
      return ringJson({ success: false, error: "Session not found." }, 404);
    }
    if (session.agencyId !== user.agencyId) {
      return ringJson({ success: false, error: "Forbidden" }, 403);
    }
    if (session.streamStatus !== "ACTIVE" && session.streamStatus !== "PENDING") {
      return ringJson(
        { success: false, error: `Stream is ${session.streamStatus.toLowerCase()}.` },
        409,
      );
    }
    if (!session.streamReference?.trim()) {
      return ringJson({ success: false, error: "Stream bridge not yet ready — retry shortly." }, 409);
    }

    const token = await kvs.issueViewerToken(session.streamReference.trim());

    return ringJson({
      success: true,
      data: {
        sessionId,
        incidentId: session.incidentId,
        deviceId: session.deviceId,
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
        msg: "ring_stream_viewer_token_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringJson({ success: false, error: "Unable to issue stream viewer token." }, 500);
  }
};
