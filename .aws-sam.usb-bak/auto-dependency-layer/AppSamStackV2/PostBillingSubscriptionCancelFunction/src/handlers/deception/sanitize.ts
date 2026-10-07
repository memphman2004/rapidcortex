const SENSITIVE_KEY = /secret|token|password|key|auth|credential/i;

function redactSensitiveKeysInObject(obj: unknown, depth: number): unknown {
  if (depth > 8) return "[TRUNCATED_DEPTH]";
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((x) => redactSensitiveKeysInObject(x, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = redactSensitiveKeysInObject(v, depth + 1);
    }
  }
  return out;
}

/** Strips Authorization, Cookie, X-Api-Key values; keeps header names. */
export function sanitizeHeaders(headers: Record<string, string | undefined> | undefined): string {
  if (!headers) return "{}";
  const out: Record<string, string> = {};
  for (const [rawK, rawV] of Object.entries(headers)) {
    if (!rawK) continue;
    const k = rawK.toLowerCase();
    const v = rawV ?? "";
    if (k === "authorization" || k === "cookie" || k === "x-api-key") {
      out[rawK] = "[REDACTED]";
    } else {
      out[rawK] = v.length > 200 ? `${v.slice(0, 200)}…` : v;
    }
  }
  try {
    return JSON.stringify(out);
  } catch {
    return "{}";
  }
}

export function sanitizePayload(body: string | undefined | null, maxLen = 500): string {
  if (!body || !body.trim()) return "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    const t = body.replace(/\s+/g, " ").trim();
    return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
  }
  const redacted = redactSensitiveKeysInObject(parsed, 0);
  let s: string;
  try {
    s = JSON.stringify(redacted);
  } catch {
    return "[UNSERIALIZABLE]";
  }
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
}

export function sanitizeQuery(query: Record<string, string | undefined> | undefined): string {
  if (!query || Object.keys(query).length === 0) return "";
  const redacted: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) {
    if (SENSITIVE_KEY.test(k)) redacted[k] = "[REDACTED]";
    else redacted[k] = v ?? "";
  }
  try {
    return JSON.stringify(redacted);
  } catch {
    return "";
  }
}
