/**
 * Google Nest Smart Device Management (SDM) API client.
 * Streams use GenerateWebRtcStream (client offer → Nest answer).
 */

const SDM_BASE = "https://smartdevicemanagement.googleapis.com/v1";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export type NestDevice = {
  deviceId: string;
  name: string;
  displayName: string;
  type: string;
  traits: Record<string, unknown>;
  status: "ONLINE" | "OFFLINE" | "UNKNOWN";
  hasLiveStream: boolean;
};

export type NestWebRtcStreamResult = {
  answerSdp: string;
  mediaSessionId: string;
  expiresAt: number;
};

export type NestRefreshedToken = {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
};

function deviceIdFromName(name: string): string {
  const parts = name.split("/");
  return parts[parts.length - 1] ?? name;
}

function hasLiveStreamTrait(traits: Record<string, unknown> | undefined): boolean {
  if (!traits) return false;
  return (
    "sdm.devices.traits.CameraLiveStream" in traits ||
    "sdm.devices.traits.CameraClipPreview" in traits
  );
}

function deviceStatus(traits: Record<string, unknown> | undefined): NestDevice["status"] {
  const connectivity = traits?.["sdm.devices.traits.Connectivity"] as
    | { status?: string }
    | undefined;
  const raw = connectivity?.status?.toUpperCase();
  if (raw === "ONLINE") return "ONLINE";
  if (raw === "OFFLINE") return "OFFLINE";
  return "UNKNOWN";
}

function displayNameFrom(traits: Record<string, unknown> | undefined, fallback: string): string {
  const info = traits?.["sdm.devices.traits.Info"] as { customName?: string } | undefined;
  const custom = info?.customName?.trim();
  return custom || fallback;
}

export class NestSDMClient {
  async listDevices(projectId: string, accessToken: string): Promise<NestDevice[]> {
    const url = `${SDM_BASE}/enterprises/${encodeURIComponent(projectId)}/devices`;
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SDM listDevices failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      devices?: Array<{ name?: string; type?: string; traits?: Record<string, unknown> }>;
    };
    return (json.devices ?? []).map((d) => {
      const name = d.name ?? "";
      const id = deviceIdFromName(name);
      const traits = d.traits ?? {};
      return {
        deviceId: id,
        name,
        displayName: displayNameFrom(traits, id),
        type: d.type ?? "sdm.devices.types.CAMERA",
        traits,
        status: deviceStatus(traits),
        hasLiveStream: hasLiveStreamTrait(traits),
      };
    });
  }

  /**
   * Client creates an SDP offer; Nest returns the answer SDP + media session id.
   */
  async generateWebRtcStream(
    projectId: string,
    deviceId: string,
    accessToken: string,
    offerSdp: string,
  ): Promise<NestWebRtcStreamResult> {
    const deviceName = `enterprises/${projectId}/devices/${deviceId}`;
    const url = `${SDM_BASE}/${deviceName}:executeCommand`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        command: "sdm.devices.commands.CameraLiveStream.GenerateWebRtcStream",
        params: { offerSdp },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SDM GenerateWebRtcStream failed (${res.status}): ${text.slice(0, 400)}`);
    }
    const json = (await res.json()) as {
      results?: {
        answerSdp?: string;
        mediaSessionId?: string;
        expiresAt?: string;
      };
    };
    const answerSdp = json.results?.answerSdp?.trim() ?? "";
    const mediaSessionId = json.results?.mediaSessionId?.trim() ?? "";
    if (!answerSdp || !mediaSessionId) {
      throw new Error("SDM GenerateWebRtcStream missing answerSdp or mediaSessionId");
    }
    const expiresAt = json.results?.expiresAt
      ? Date.parse(json.results.expiresAt)
      : Date.now() + 5 * 60 * 1000;
    return { answerSdp, mediaSessionId, expiresAt };
  }

  async stopWebRtcStream(
    projectId: string,
    deviceId: string,
    mediaSessionId: string,
    accessToken: string,
  ): Promise<void> {
    const deviceName = `enterprises/${projectId}/devices/${deviceId}`;
    const url = `${SDM_BASE}/${deviceName}:executeCommand`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        command: "sdm.devices.commands.CameraLiveStream.StopWebRtcStream",
        params: { mediaSessionId },
      }),
    });
    if (!res.ok && res.status !== 404) {
      const text = await res.text();
      throw new Error(`SDM StopWebRtcStream failed (${res.status}): ${text.slice(0, 300)}`);
    }
  }

  async refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string,
  ): Promise<NestRefreshedToken> {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
      error?: string;
      error_description?: string;
    };
    if (!res.ok || !json.access_token) {
      throw new Error(json.error_description ?? json.error ?? "Nest token refresh failed");
    }
    return {
      accessToken: json.access_token,
      expiresIn: json.expires_in ?? 3600,
      refreshToken: json.refresh_token,
    };
  }
}

export const nestSdmClient = new NestSDMClient();
