import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({});

type Cache = { value: string; expiresAt: number };
let cache: Cache | null = null;

const TTL_MS = 5 * 60 * 1000;

function extractApiKey(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return trimmed;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const key = parsed.apiKey ?? parsed.API_KEY ?? parsed.key;
    if (typeof key === "string" && key.trim()) return key.trim();
  } catch {
    /* fall through */
  }
  throw new Error("watch_ingest_secret_invalid_shape");
}

export async function getWatchIngestApiKey(secretArn: string): Promise<string> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  const res = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const raw = res.SecretString ?? "";
  if (!raw) throw new Error("watch_ingest_secret_empty");
  const value = extractApiKey(raw);
  cache = { value, expiresAt: now + TTL_MS };
  return value;
}

/** Test helper — clear in-memory cache. */
export function clearWatchIngestKeyCache(): void {
  cache = null;
}
