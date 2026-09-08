import { createHash, timingSafeEqual } from "node:crypto";
import {
  parseWebhookSignatureVariants,
  verifyRcLiteWebhookSignature,
} from "rapid-cortex-shared/dist/rc-lite/webhook-signing";
import { env } from "../lib/env.js";

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

export function verifyPhysicalSecurityWebhookAuth(
  event: { headers?: Record<string, string | undefined> },
  rawBody: string,
): { ok: true } | { ok: false; reason: string } {
  if (env.physicalSecurityIngestMock) return { ok: true };

  const secret = env.physicalSecurityWebhookSecret;
  if (!secret) return { ok: false, reason: "webhook_secret_not_configured" };

  const token = header(event, "x-rc-token") || header(event, "x-rapidcortex-token");
  if (token) {
    return tokenMatches(token, secret) ? { ok: true } : { ok: false, reason: "token_mismatch" };
  }

  const tsRaw = header(event, "x-rapidcortex-timestamp") || header(event, "x-rc-timestamp");
  const sigHeader = header(event, "x-rapidcortex-signature") || header(event, "x-rc-signature");
  const timestampSec = Number(tsRaw);
  if (!Number.isFinite(timestampSec) || !sigHeader) {
    return { ok: false, reason: "missing_signature" };
  }
  const variants = parseWebhookSignatureVariants(sigHeader);
  return verifyRcLiteWebhookSignature(secret, timestampSec, rawBody, variants);
}
