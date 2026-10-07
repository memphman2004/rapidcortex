/** Structured redaction for logs — never substitute regulatory certification language; this is defensive coding only. */

export const REDACTED = "[REDACTED]";

const SENSITIVE_KEY =
  /authorization|cookie|token|secret|apikey|api_key|password|signature|credential|privatekey|private_key|refreshtoken|access_token|id_token|bearer/i;

/** True when a record key likely holds credentials (case-insensitive). */
export function isSensitiveHeaderOrFieldName(name: string): boolean {
  return SENSITIVE_KEY.test(name.trim());
}

function redactStringValue(name: string, value: string): string {
  if (isSensitiveHeaderOrFieldName(name)) return REDACTED;
  const t = value.trim();
  if (/^Bearer\s+\S+/i.test(t)) return REDACTED;
  if (/^Basic\s+\S+/i.test(t)) return REDACTED;
  if (t.length > 12_000) return `[large string ${t.length} bytes]`;
  return value;
}

/**
 * Returns a shallow copy of headers with sensitive names/values masked.
 * Use before logging APIGateway `event.headers`.
 */
export function redactHeaders(
  headers: Record<string, string | undefined> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  for (const [k, v] of Object.entries(headers)) {
    if (v === undefined) continue;
    const key = k;
    out[key] = isSensitiveHeaderOrFieldName(key) ? REDACTED : redactStringValue(key, v);
  }
  return out;
}

/** Deep-ish JSON-safe redaction for structured logs (cycles avoided via depth limit). */
export function redactUnknown(value: unknown, depth = 0): unknown {
  if (depth > 14) return "[MAX_DEPTH]";
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") {
    if (value.length > 16_384) return `[string ${value.length} chars]`;
    if (/^Bearer\s+/i.test(value.trim())) return REDACTED;
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((v) => redactUnknown(v, depth + 1));
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      if (isSensitiveHeaderOrFieldName(k)) {
        next[k] = REDACTED;
      } else {
        next[k] = redactUnknown(v, depth + 1);
      }
    }
    return next;
  }
  return String(value);
}

/** Convenience alias for plain meta objects passed to logger. */
export function redactRecord(meta: Record<string, unknown>): Record<string, unknown> {
  return redactUnknown(meta) as Record<string, unknown>;
}
