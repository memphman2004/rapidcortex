import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { ConnectSource } from "../../connect/connect-types.js";
import { ConnectAccessGuard } from "../../connect/connect-access-guard.js";
import { resolveOnvifStreamUri } from "../../connect/onvif/onvif-resolver.js";
import { BridgeSessionService } from "../../shared/bridge-session-service.js";
import { KvsChannelService } from "../../shared/kvs-channel-service.js";

const kvsService = new KvsChannelService();
const bridge = new BridgeSessionService(kvsService);
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function getGuard() {
  return new ConnectAccessGuard(ddb);
}

function venueSessionsTableName(): string {
  return (
    process.env.VENUE_CAMERA_SESSIONS_TABLE?.trim() ||
    process.env.CONNECT_SESSIONS_TABLE?.trim() ||
    ""
  );
}

async function resolveRtspUrl(source: ConnectSource): Promise<string> {
  if (!source.rtspUrl) throw new Error(`Venue source ${source.sourceId} has no rtspUrl`);
  return source.rtspUrl;
}

export async function resolveVenueStreamForSource(
  source: ConnectSource,
  sessionId: string,
  incidentId: string,
): Promise<{ kvsChannelName: string; ecsTaskArn?: string }> {
  if (source.protocol === "RTSP" || source.protocol === "ONVIF") {
    const rtspUrl =
      source.protocol === "ONVIF" ? await resolveOnvifStreamUri(source) : await resolveRtspUrl(source);
    return bridge.startBridge({
      sessionId,
      incidentId,
      rtspUrl,
      credentialsSecretArn: source.credentialsSecretArn,
      product: "venue",
      sessionsTableName: venueSessionsTableName(),
    });
  }

  if (source.protocol === "WEBRTC") {
    const kvsChannelName = await kvsService.createSessionChannel(sessionId, "rc-venue");
    return { kvsChannelName };
  }

  throw new Error(`Unsupported venue camera protocol: ${source.protocol}`);
}

export async function assertVenueIncidentActive(incidentId: string, agencyId: string): Promise<void> {
  const guard = getGuard();
  await guard.assertActiveIncident(incidentId, agencyId);
}
