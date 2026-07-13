import { createHmac, timingSafeEqual } from "node:crypto";

/** Ring Appstore account-link nonce freshness window (10 minutes). */
export const RING_LINK_NONCE_MAX_AGE_SECONDS = 600;

/**
 * Compute Appstore account-link nonce:
 * URL-safe Base64 (no padding) of HMAC-SHA256(K_hmac, "<time_ms>:<account_id>").
 */
export function computeRingLinkNonce(
  timeMs: string | number,
  accountId: string,
  hmacKey: string,
): string {
  const payload = `${timeMs}:${accountId}`;
  const mac = createHmac("sha256", hmacKey).update(payload, "utf8").digest();
  return mac
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function validateRingLinkTimestamp(timeMs: string | number): {
  ok: boolean;
  reason?: string;
} {
  const t = typeof timeMs === "number" ? timeMs : Number(timeMs);
  if (!Number.isFinite(t) || t <= 0) {
    return { ok: false, reason: "invalid_time" };
  }
  const deltaSeconds = (Date.now() - t) / 1000;
  if (deltaSeconds < 0) {
    return { ok: false, reason: "time_in_future" };
  }
  if (deltaSeconds > RING_LINK_NONCE_MAX_AGE_SECONDS) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true };
}

export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Mask email for App-Integrations `account_identifier` (e.g. j***n@example.com). */
export function maskEmailForRing(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.indexOf("@");
  if (at <= 0) return "***@***";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (local.length <= 2) {
    return `${local[0] ?? "*"}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}
