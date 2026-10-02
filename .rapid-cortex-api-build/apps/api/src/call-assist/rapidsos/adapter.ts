import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { env } from "../../lib/env.js";
import type { RapidSosLocationCandidate } from "./types.js";

export type { RapidSosLocationCandidate };

type RapidSosSecret = {
  apiUrl?: string;
  apiKey?: string;
  baseUrl?: string;
};

const secrets = new SecretsManagerClient({});

async function loadCredentials(): Promise<{ apiUrl: string; apiKey: string } | null> {
  const arn = env.callAssistRapidSosSecretArn;
  if (!arn) return null;
  try {
    const out = await secrets.send(new GetSecretValueCommand({ SecretId: arn }));
    const raw = out.SecretString?.trim() ?? "";
    if (!raw) return null;
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw) as RapidSosSecret;
      const apiUrl = (parsed.apiUrl || parsed.baseUrl || "").trim();
      const apiKey = (parsed.apiKey || "").trim();
      if (!apiUrl || !apiKey) return null;
      return { apiUrl, apiKey };
    }
    // Plain key with URL from env.
    const apiUrl = process.env.CALL_ASSIST_RAPIDSOS_API_URL?.trim() ?? "";
    if (!apiUrl) return null;
    return { apiUrl, apiKey: raw };
  } catch {
    return null;
  }
}

function parseCandidate(payload: unknown): RapidSosLocationCandidate | null {
  if (!payload || typeof payload !== "object") return null;
  const body = payload as Record<string, unknown>;
  const location =
    (body.location as Record<string, unknown> | undefined) ||
    (body.data as Record<string, unknown> | undefined) ||
    body;
  const lat = Number(location.lat ?? location.latitude ?? location.y);
  const lng = Number(location.lng ?? location.lon ?? location.longitude ?? location.x);
  const uncertaintyMeters = Number(
    location.uncertaintyMeters ?? location.uncertainty ?? location.accuracyMeters ?? location.accuracy,
  );
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    source: "RAPIDSOS",
    candidateOnly: true,
    lat,
    lng,
    uncertaintyMeters: Number.isFinite(uncertaintyMeters) ? uncertaintyMeters : undefined,
  };
}

/**
 * Read-only RapidSOS context. Never blocks the call. Location is a candidate only.
 * Fail-open: any error / missing secret / mock mode returns null.
 * KCPD RFP line 12 is N_A — do not bid RapidSOS; this path is for other tenants only.
 */
export async function lookupRapidSosLocation(opts: {
  agencyId: string;
  ani?: string;
  mock: boolean;
}): Promise<RapidSosLocationCandidate | null> {
  try {
    if (opts.mock || !opts.ani) return null;
    const creds = await loadCredentials();
    if (!creds) return null;

    const url = new URL("/v1/location", creds.apiUrl.replace(/\/$/, ""));
    url.searchParams.set("ani", opts.ani);
    url.searchParams.set("agencyId", opts.agencyId);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${creds.apiKey}`,
        "X-API-Key": creds.apiKey,
      },
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    return parseCandidate(json);
  } catch {
    return null;
  }
}
