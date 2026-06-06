import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({});

type CachedSecret =
  | { kind: "string"; value: string; fetchedAt: number }
  | { kind: "object"; value: Record<string, unknown>; fetchedAt: number };

const cache = new Map<string, CachedSecret>();
const TTL_MS = 300_000;

/**
 * Default field-name fallback chain used when no `preferredField` is supplied.
 * Order matters: callers without a preferred field will receive the first
 * matching value, which is fine for single-purpose secrets but ambiguous for
 * shared ones (e.g. an Azure multilingual secret containing both
 * `azureSpeechKey` and `azureTranslationKey`).
 *
 * Always pass `preferredField` from a shared secret to avoid collisions.
 */
const DEFAULT_KEY_FALLBACK_CHAIN = [
  "apiKey",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "AZURE_SPEECH_KEY",
  "azureSpeechKey",
  "AZURE_TRANSLATION_KEY",
  "azureTranslationKey",
  "key",
] as const;

async function readCachedSecret(arn: string): Promise<CachedSecret> {
  const now = Date.now();
  const hit = cache.get(arn);
  if (hit && now - hit.fetchedAt < TTL_MS) return hit;

  const out = await client.send(new GetSecretValueCommand({ SecretId: arn }));
  const raw = out.SecretString ?? "";
  let value = raw.trim();
  if (!value && out.SecretBinary) {
    value = Buffer.from(out.SecretBinary).toString("utf8").trim();
  }
  let cached: CachedSecret;
  if (value.startsWith("{")) {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      cached = { kind: "object", value: parsed, fetchedAt: now };
    } catch {
      cached = { kind: "string", value, fetchedAt: now };
    }
  } else {
    cached = { kind: "string", value, fetchedAt: now };
  }
  cache.set(arn, cached);
  return cached;
}

function pickFromObject(obj: Record<string, unknown>, preferredField: string | undefined): string {
  if (preferredField) {
    const v = obj[preferredField];
    if (typeof v === "string" && v.trim()) return v;
  }
  for (const k of DEFAULT_KEY_FALLBACK_CHAIN) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

/**
 * Prefer inline env; otherwise fetch from Secrets Manager when ARN is set.
 *
 * For JSON secrets, `preferredField` selects the intended JSON field (recommended
 * whenever the secret may contain multiple keys, e.g. shared Azure multilingual
 * secrets that hold both speech and translator keys). When `preferredField` is
 * omitted or not present in the JSON, falls back to {@link DEFAULT_KEY_FALLBACK_CHAIN}
 * for backward compatibility with existing callers.
 *
 * @example
 *   // Azure Translator (shared secret with speech key)
 *   await resolvePlainOrSecretArn(cfg.azureTranslatorKey, cfg.azureTranslatorKeySecretArn, {
 *     preferredField: "azureTranslationKey",
 *   });
 */
export async function resolvePlainOrSecretArn(
  plain: string | undefined,
  secretArn: string | undefined,
  opts?: { preferredField?: string },
): Promise<string> {
  const p = plain?.trim() ?? "";
  if (p) return p;
  const arn = secretArn?.trim() ?? "";
  if (!arn) return "";
  const entry = await readCachedSecret(arn);
  if (entry.kind === "string") return entry.value;
  return pickFromObject(entry.value, opts?.preferredField);
}

export function clearRuntimeSecretsCacheForTests(): void {
  cache.clear();
}
