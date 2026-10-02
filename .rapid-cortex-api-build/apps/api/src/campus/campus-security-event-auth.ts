import { createHash, timingSafeEqual } from "node:crypto";
import {
  parseWebhookSignatureVariants,
  verifyRcLiteWebhookSignature,
} from "rapid-cortex-shared/dist/rc-lite/webhook-signing";

export function campusSecurityEventMockEnabled(): boolean {
  const v = process.env.ENABLE_CAMPUS_SECURITY_EVENTS_MOCK?.trim();
  return v === "1" || v === "true";
}

function header(event: { headers?: Record<string, string | undefined> }, name: string): string {
  const headers = event.headers ?? {};
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower && value) return value;
  }
  return "";
}

function tokenMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * HMAC (X-RapidCortex-Timestamp + X-RapidCortex-Signature) or shared token (X-RC-Token).
 * Mock path is for local/CI only.
 */
export function verifyCampusSecurityEventAuth(
  event: { headers?: Record<string, string | undefined> },
  rawBody: string,
): { ok: true } | { ok: false; reason: string } {
  if (campusSecurityEventMockEnabled()) return { ok: true };

  const secret = process.env.CAMPUS_SECURITY_EVENT_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) return { ok: false, reason: "webhook_secret_not_configured" };

  const token = header(event, "x-rc-token") || header(event, "x-rapidcortex-token");
  if (token) {
    return tokenMatches(token, secret) ? { ok: true } : { ok: false, reason: "token_mismatch" };
  }

  const tsRaw = header(event, "x-rapidcortex-timestamp") || header(event, "x-rc-timestamp");
  const sigHeader =
    header(event, "x-rapidcortex-signature") || header(event, "x-rc-signature");
  const timestampSec = Number(tsRaw);
  if (!Number.isFinite(timestampSec) || !sigHeader) {
    return { ok: false, reason: "missing_signature" };
  }
  const variants = parseWebhookSignatureVariants(sigHeader);
  return verifyRcLiteWebhookSignature(secret, timestampSec, rawBody, variants);
}
