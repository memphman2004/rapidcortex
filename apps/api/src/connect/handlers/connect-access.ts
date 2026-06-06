import type { ConnectSource } from "../connect-types.js";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { ringAdapter } from "../adapters/ring-adapter.js";
import { resolveOnvifStreamUri } from "../onvif/onvif-resolver.js";
import { BridgeSessionService } from "../../shared/bridge-session-service.js";
import { KvsChannelService } from "../../shared/kvs-channel-service.js";

const kvsService = new KvsChannelService();
const bridge = new BridgeSessionService(kvsService);
const sm = new SecretsManagerClient({});

async function resolveRtspUrl(source: ConnectSource): Promise<string> {
  if (!source.rtspUrl) {
    throw new Error(`Source ${source.sourceId} has no RTSP URL configured`);
  }
  if (source.rtspUrl.match(/^rtsp:\/\/[^@]+@/)) {
    return source.rtspUrl;
  }
  if (!source.credentialsSecretArn) {
    return source.rtspUrl;
  }
  const result = await sm.send(new GetSecretValueCommand({ SecretId: source.credentialsSecretArn }));
  if (!result.SecretString) {
    throw new Error(`Credentials secret has no SecretString for source ${source.sourceId}`);
  }
  const creds = JSON.parse(result.SecretString) as { username: string; password: string };
  return source.rtspUrl.replace(
    /^rtsp:\/\//,
    `rtsp://${encodeURIComponent(creds.username)}:${encodeURIComponent(creds.password)}@`,
  );
}

export async function resolveStreamForSource(
  source: ConnectSource,
  sessionId: string,
  incidentId: string,
): Promise<{ kvsChannelName: string; ecsTaskArn?: string }> {
  if (source.sourceType === "DOORBELL") {
    if (ringAdapter.isAvailable()) {
      try {
        const rtspUrl = await ringAdapter.resolveStreamUrl(source);
        return await bridge.startBridge({
          sessionId,
          incidentId,
          rtspUrl,
          product: "connect",
          sessionsTableName: process.env.CONNECT_SESSIONS_TABLE?.trim() || "",
        });
      } catch (err) {
        console.warn("[ring] API failed, trying RTSP fallback:", err);
      }
    }
    if (ringAdapter.canUseRtspFallback(source) && source.rtspUrl) {
      const rtspUrl = await resolveRtspUrl(source);
      return await bridge.startBridge({
        sessionId,
        incidentId,
        rtspUrl,
        credentialsSecretArn: source.credentialsSecretArn,
        product: "connect",
        sessionsTableName: process.env.CONNECT_SESSIONS_TABLE?.trim() || "",
      });
    }
    throw new Error("Ring device: partnership not enabled and no RTSP fallback configured");
  }

  if (source.protocol === "RTSP" || source.protocol === "ONVIF") {
    const rtspUrl =
      source.protocol === "ONVIF" ? await resolveOnvifStreamUri(source) : await resolveRtspUrl(source);
    return await bridge.startBridge({
      sessionId,
      incidentId,
      rtspUrl,
      credentialsSecretArn: source.credentialsSecretArn,
      product: "connect",
      sessionsTableName: process.env.CONNECT_SESSIONS_TABLE?.trim() || "",
    });
  }

  if (source.protocol === "WEBRTC") {
    const kvsChannelName = await kvsService.createSessionChannel(sessionId, "rc-connect");
    return { kvsChannelName };
  }

  throw new Error(`Unsupported protocol: ${source.protocol}`);
}
