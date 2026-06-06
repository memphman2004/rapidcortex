import type { AuditEvent } from "rapid-cortex-shared";

const SENSITIVE_DETAIL_KEYS = new Set(
  [
    "password",
    "temporaryPassword",
    "secret",
    "apiKey",
    "token",
    "refreshToken",
    "idToken",
    "accessToken",
    "authorization",
  ].map((k) => k.toLowerCase()),
);

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  if (SENSITIVE_DETAIL_KEYS.has(k)) return true;
  return k.includes("secret") || k.includes("token") || k.includes("password");
}

function redactDetails(details: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (isSensitiveKey(key)) {
      out[key] = "[redacted]";
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = redactDetails(value as Record<string, unknown>);
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Pilot-safe shape for audit list APIs: stable resource hints + no secret-bearing detail keys.
 */
export function normalizeAuditEventForApi(event: AuditEvent): AuditEvent {
  return {
    ...event,
    details: redactDetails(event.details ?? {}),
  };
}
