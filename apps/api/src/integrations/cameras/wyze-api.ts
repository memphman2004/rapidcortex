/**
 * Wyze Developer API client.
 *
 * Per-homeowner Key ID + API Key (Apikey / Keyid headers). NexCort iQ developer
 * credentials in Secrets Manager are for RC-owned test devices only — never used
 * for homeowner streams.
 *
 * WYZE_MOCK does not invent cameras or signaling URLs.
 *
 * @module integrations/cameras/wyze-api
 */

export type WyzeCreds = { keyId: string; apiKey: string };

export type WyzeCamera = {
  mac: string;
  model: string;
  name: string;
  isOnline: boolean;
  hasLiveStream: boolean;
};

export type WyzeStreamInfo = {
  signalingUrl: string;
  iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  authToken: string;
  clientId: string;
  expiresAt: number;
};

const WYZE_API_BASE = "https://api.wyzecam.com";

/** Known camera product model prefixes that support live streaming. */
const STREAMABLE_MODEL_PREFIXES = [
  "WYZEC",
  "WYZECP",
  "WVOD",
  "WVDB",
  "WYZEDB",
  "LD_CFP",
  "AN_RSCW",
];

function authHeaders(creds: WyzeCreds): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Apikey: creds.apiKey,
    Keyid: creds.keyId,
  };
}

function generateClientId(mac: string): string {
  return `rc-viewer-${mac.replace(/:/g, "")}-${Date.now()}`;
}

function normalizeIceServers(raw: unknown): WyzeStreamInfo["iceServers"] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => {
    const row = s as Record<string, unknown>;
    return {
      urls: (row.url ?? row.urls) as string | string[],
      username: row.username as string | undefined,
      credential: row.credential as string | undefined,
    };
  });
}

export function isStreamableCamera(model: string): boolean {
  const upper = model.toUpperCase();
  return STREAMABLE_MODEL_PREFIXES.some((p) => upper.startsWith(p));
}

export class WyzeApiClient {
  async listCameras(creds: WyzeCreds): Promise<WyzeCamera[]> {
    const res = await fetch(`${WYZE_API_BASE}/v2/home_page/get_object_list`, {
      method: "POST",
      headers: authHeaders(creds),
      body: JSON.stringify({
        sv: "9b2bdd9344f64555dc4ab0ccfc70eb5e",
        sc: "9f275790cab94a72bd206c8876429f3c",
        ts: Date.now(),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Wyze listCameras failed (${res.status}): ${text.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      code?: string;
      msg?: string;
      data?: {
        device_list?: Array<{
          mac?: string;
          product_model?: string;
          nickname?: string;
          conn_state?: number;
          product_type?: string;
        }>;
      };
    };

    if (json.code !== "1") {
      throw new Error(`Wyze API error: ${json.msg ?? json.code ?? "unknown"}`);
    }

    return (json.data?.device_list ?? [])
      .filter(
        (d) =>
          d.product_type === "Camera" || isStreamableCamera(d.product_model ?? ""),
      )
      .map((d) => ({
        mac: d.mac ?? "",
        model: d.product_model ?? "",
        name: d.nickname ?? d.mac ?? "Unnamed camera",
        isOnline: d.conn_state === 1,
        hasLiveStream: isStreamableCamera(d.product_model ?? ""),
      }))
      .filter((c) => c.mac && c.hasLiveStream);
  }

  async getStreamInfo(mac: string, model: string, creds: WyzeCreds): Promise<WyzeStreamInfo> {
    const clientId = generateClientId(mac);
    const res = await fetch(`${WYZE_API_BASE}/v2/cameraservice/get_webrtc_conn_info`, {
      method: "POST",
      headers: authHeaders(creds),
      body: JSON.stringify({
        sv: "9b2bdd9344f64555dc4ab0ccfc70eb5e",
        sc: "9f275790cab94a72bd206c8876429f3c",
        ts: Date.now(),
        device_mac: mac,
        device_model: model,
        client_id: clientId,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Wyze getStreamInfo failed (${res.status}): ${text.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      code?: string;
      msg?: string;
      data?: {
        signaling_url?: string;
        ice_servers?: unknown;
        auth_token?: string;
        exp?: number;
      };
    };

    if (json.code !== "1") {
      throw new Error(`Wyze stream info error: ${json.msg ?? json.code ?? "unknown"}`);
    }

    const data = json.data ?? {};
    const signalingUrl = (data.signaling_url ?? "").trim();
    const authToken = (data.auth_token ?? "").trim();
    if (!signalingUrl || !authToken) {
      throw new Error(
        `Wyze getStreamInfo returned incomplete data (mac=${mac}): signalingUrl=${!!signalingUrl} authToken=${!!authToken}`,
      );
    }

    const urlWithClient = signalingUrl.includes("X-Amz-ClientId")
      ? signalingUrl
      : `${signalingUrl}${signalingUrl.includes("?") ? "&" : "?"}X-Amz-ClientId=${encodeURIComponent(clientId)}`;

    return {
      signalingUrl: urlWithClient,
      iceServers: normalizeIceServers(data.ice_servers),
      authToken,
      clientId,
      expiresAt: data.exp ? data.exp * 1000 : Date.now() + 5 * 60 * 1000,
    };
  }

  async validateCredentials(creds: WyzeCreds): Promise<number> {
    const cameras = await this.listCameras(creds);
    return cameras.length;
  }
}

export const wyzeApiClient = new WyzeApiClient();
