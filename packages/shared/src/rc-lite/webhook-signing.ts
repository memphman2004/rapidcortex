/**
 * Signed webhook payloads (Stripe/Plaid-style):
 * Signature: `sha256_hmac(secret, '${timestamp}.${rawBody}', 'hex')` or v1 prefixed line format.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** Send `X-RapidCortex-Timestamp`, `X-RapidCortex-Signature` (comma-separated variants). */

export type RcLiteWebhookSigningVersion = "v1";

export function buildRcLiteWebhookSigningPayload(timestampSec: number, rawBodyUtf8: string): string {
  return `${timestampSec}.${rawBodyUtf8}`;
}

/** Returns signature bytes as hex lowercase. */

export function signRcLiteWebhookBody(signingSecret: string, timestampSec: number, rawBodyUtf8: string): string {
  const payload = buildRcLiteWebhookSigningPayload(timestampSec, rawBodyUtf8);
  return createHmac("sha256", signingSecret).update(payload).digest("hex");
}

/** Format transmitted to consumers (single signature variant example). */

export function formatRcLiteWebhookSigHeader(version: RcLiteWebhookSigningVersion, sigHex: string): string {
  return `${version}=${sigHex}`;
}

/** Parse Stripe-like `v1=<hex>` or raw hex formats. */

export function parseWebhookSignatureVariants(headerVal: string | null | undefined): string[] {
  if (!headerVal?.trim()) return [];
  const out: string[] = [];
  const parts = headerVal.split(",").map((p) => p.trim()).filter(Boolean);
  for (const p of parts) {
    const m = /^v\d+=([0-9a-f]+)$/i.exec(p);
    if (m) out.push(m[1].toLowerCase());
    else if (/^[0-9a-f]{64}$/i.test(p)) out.push(p.toLowerCase());
  }
  return out;
}

/** Verifies webhook using constant-time equality (secret never logged). */

export function verifyRcLiteWebhookSignature(
  signingSecret: string,
  timestampSec: number,
  rawBodyUtf8: string,
  headerSignatures: readonly string[],
  opts?: {
    toleranceSec?: number;
    nowMs?: number;
  },
): { ok: true } | { ok: false; reason: string } {
  const nowMs = opts?.nowMs ?? Date.now();
  const toleranceSec = opts?.toleranceSec ?? 300;
  const ageSec = Math.abs(Math.floor(nowMs / 1000) - timestampSec);
  if (ageSec > toleranceSec) {
    return { ok: false, reason: "timestamp_outside_tolerance" };
  }
  const expected = signRcLiteWebhookBody(signingSecret, timestampSec, rawBodyUtf8);
  const bufExp = Buffer.from(expected, "hex");
  for (const raw of headerSignatures) {
    const buf = Buffer.from(raw, "hex");
    if (buf.length === bufExp.length && timingSafeEqual(buf, bufExp)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: "signature_mismatch" };
}
