/**
 * Shared ICE / TURN resolution for Video Assist (SMS caller P2P) and Live Video
 * legacy_p2p fallback. KVS WebRTC sessions prefer GetIceServerConfig from AWS.
 *
 * Secret JSON shapes (Secrets Manager, WEBRTC_TURN_SECRET_ARN):
 *   { "iceServers": [ { "urls": "...", "username"?: "...", "credential"?: "..." } ] }
 *   { "urls": "turn:…", "username": "…", "credential": "…" }
 *   [ { "urls": "…" }, … ]
 */
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { env } from "./env.js";

export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

const DEFAULT_STUN: IceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

let cachedTurn: { arn: string; servers: IceServer[]; fetchedAt: number } | null = null;
const CACHE_MS = 5 * 60_000;

function parseIceJson(raw: string): IceServer[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as IceServer[];
    }
    if (parsed && typeof parsed === "object") {
      const obj = parsed as { iceServers?: IceServer[]; urls?: string | string[] };
      if (Array.isArray(obj.iceServers) && obj.iceServers.length > 0) return obj.iceServers;
      if (obj.urls) {
        return [
          {
            urls: obj.urls,
            username: (obj as IceServer).username,
            credential: (obj as IceServer).credential,
          },
        ];
      }
    }
  } catch {
    // fall through
  }
  return null;
}

function fromEnvJson(): IceServer[] | null {
  const raw =
    process.env.WEBRTC_ICE_SERVERS_JSON?.trim() ||
    process.env.VIDEO_ASSIST_ICE_SERVERS_JSON?.trim() ||
    "";
  if (!raw) return null;
  return parseIceJson(raw);
}

async function fromTurnSecret(arn: string): Promise<IceServer[] | null> {
  const now = Date.now();
  if (cachedTurn && cachedTurn.arn === arn && now - cachedTurn.fetchedAt < CACHE_MS) {
    return cachedTurn.servers;
  }
  try {
    const sm = new SecretsManagerClient({ region: env.region });
    const out = await sm.send(new GetSecretValueCommand({ SecretId: arn }));
    const raw = out.SecretString?.trim() ?? "";
    if (!raw) return null;
    const servers = parseIceJson(raw);
    if (!servers?.length) return null;
    cachedTurn = { arn, servers, fetchedAt: now };
    return servers;
  } catch {
    return null;
  }
}

/** Resolve ICE servers: env JSON → TURN secret → Google STUN fallback. */
export async function resolveWebRtcIceServers(): Promise<IceServer[]> {
  const fromEnv = fromEnvJson();
  if (fromEnv?.length) return fromEnv;

  const arn = env.webrtcTurnSecretArn;
  if (arn) {
    const fromSecret = await fromTurnSecret(arn);
    if (fromSecret?.length) {
      // Keep a public STUN alongside TURN for host-candidate discovery.
      const hasStun = fromSecret.some((s) => {
        const u = Array.isArray(s.urls) ? s.urls.join(",") : String(s.urls ?? "");
        return u.toLowerCase().includes("stun:");
      });
      return hasStun ? fromSecret : [...DEFAULT_STUN, ...fromSecret];
    }
  }

  return DEFAULT_STUN;
}

/** True when TURN (or non-default ICE) is configured — useful for ops health checks. */
export function isCustomIceConfigured(): boolean {
  return Boolean(
    process.env.WEBRTC_ICE_SERVERS_JSON?.trim() ||
      process.env.VIDEO_ASSIST_ICE_SERVERS_JSON?.trim() ||
      env.webrtcTurnSecretArn,
  );
}

/**
 * Strict stages require TURN for Video Assist (SMS P2P) — STUN alone fails on cellular NAT.
 * Escape hatch: VIDEO_ASSIST_ALLOW_STUN_ONLY=1 (lab/CI only).
 */
export function requiresVideoAssistTurn(): boolean {
  const allowStun =
    process.env.VIDEO_ASSIST_ALLOW_STUN_ONLY?.trim().toLowerCase() === "1" ||
    process.env.VIDEO_ASSIST_ALLOW_STUN_ONLY?.trim().toLowerCase() === "true";
  if (allowStun) return false;
  const stage = (process.env.DEPLOYMENT_STAGE ?? process.env.STAGE ?? "").trim().toLowerCase();
  return stage === "prod" || stage === "pilot" || stage === "staging" || stage === "dev";
}

/** Fail closed for Video Assist SMS P2P when production-like stages lack TURN/ICE. */
export function assertVideoAssistIceReady(): void {
  if (requiresVideoAssistTurn() && !isCustomIceConfigured()) {
    throw new Error("VIDEO_ASSIST_TURN_REQUIRED");
  }
}
