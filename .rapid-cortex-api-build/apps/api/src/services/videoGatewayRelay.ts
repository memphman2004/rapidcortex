import { videoGatewayRelayBodySchema, type VideoGatewayRelayBody, type VideoPtzPreset } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { resolvePlainOrSecretArn } from "../lib/runtimeSecrets.js";
import { signVideoGatewayBody } from "./videoGatewayHmac.js";

export function videoGatewayMockEnabled(): boolean {
  if (env.videoGatewayMock) return true;
  return !env.videoGatewayUrl;
}

async function gatewaySecret(): Promise<string> {
  return resolvePlainOrSecretArn(env.videoGatewaySecret, env.videoGatewaySecretArn, {
    preferredField: "gatewaySecret",
  });
}

export async function relayPtzToGateway(
  payload: VideoGatewayRelayBody,
): Promise<{ ok: true; mock: boolean; presets?: VideoPtzPreset[] } | { ok: false; error: string }> {
  const parsed = videoGatewayRelayBodySchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Invalid gateway payload" };

  if (videoGatewayMockEnabled()) {
    return { ok: true, mock: true };
  }

  const secret = await gatewaySecret();
  if (!secret) return { ok: false, error: "Video gateway secret is not configured" };
  if (!parsed.data.cameraIp?.trim() && parsed.data.command !== "Stop") {
    return { ok: false, error: "Camera has no on-prem IP registered" };
  }

  const body = JSON.stringify(parsed.data);
  const url = `${env.videoGatewayUrl.replace(/\/$/, "")}/relay/ptz`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-gateway-auth": signVideoGatewayBody(secret, body),
      },
      body,
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      return { ok: false, error: `Gateway relay failed (${res.status})` };
    }
    const json = (await res.json()) as { presets?: VideoPtzPreset[] };
    return { ok: true, mock: false, presets: json.presets };
  } catch (error) {
    console.warn("[rapid-cortex-video] gateway relay error", error);
    return { ok: false, error: "Gateway unavailable" };
  }
}
