/**
 * ArcGIS Location Platform auth for GIS FeatureServer queries.
 * Credentials live only in Secrets Manager (ARCGIS_SECRET_NAME → secret name, not value).
 */
import { getSecret } from "../lib/runtimeSecrets.js";

export interface ArcGISCredentials {
  type: "api_key" | "oauth";
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
  portalUrl?: string;
  expiration?: string;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getArcGISToken(): Promise<string> {
  const secretName = process.env.ARCGIS_SECRET_NAME?.trim();
  if (!secretName) throw new Error("ARCGIS_SECRET_NAME env var not set");

  const creds = await getSecret<ArcGISCredentials>(secretName);

  if (creds.type === "api_key") {
    if (!creds.apiKey?.trim()) throw new Error("ArcGIS apiKey missing in secret");
    return creds.apiKey.trim();
  }

  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.value;
  }

  const clientId = creds.clientId?.trim();
  const clientSecret = creds.clientSecret?.trim();
  const tokenUrl = creds.tokenUrl?.trim();
  if (!clientId || !clientSecret || !tokenUrl) {
    throw new Error("ArcGIS OAuth credentials incomplete in secret");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    expiration: "60",
    f: "json",
  });

  const res = await fetch(tokenUrl, { method: "POST", body: params });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: unknown;
  };

  if (!data.access_token) {
    throw new Error(`ArcGIS token fetch failed: ${JSON.stringify(data)}`);
  }

  const expiresInSec =
    typeof data.expires_in === "number" && data.expires_in > 0 ? data.expires_in : 3600;

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + expiresInSec * 1000,
  };

  return cachedToken.value;
}

/** Apply token to a FeatureServer query — API key in header only, never in the URL. */
export function applyArcGISAuth(
  url: string,
  token: string,
  credType: "api_key" | "oauth",
): { url: string; headers: Record<string, string> } {
  if (credType === "oauth") {
    return { url, headers: { Authorization: `Bearer ${token}` } };
  }
  return { url, headers: { "X-Esri-Authorization": `apiKey ${token}` } };
}

/** Test helper — clears in-memory OAuth token cache. */
export function clearArcGISTokenCacheForTests(): void {
  cachedToken = null;
}
