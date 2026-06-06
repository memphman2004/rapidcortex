import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function generateCadWebhookToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashCadWebhookToken(salt: string, token: string): string {
  return createHash("sha256").update(`${salt}:${token}`, "utf8").digest("hex");
}

export function verifyCadWebhookToken(salt: string, token: string, expectedHash: string | undefined): boolean {
  if (!expectedHash || !token) return false;
  const h = hashCadWebhookToken(salt, token);
  try {
    return timingSafeEqual(Buffer.from(h, "hex"), Buffer.from(expectedHash, "hex"));
  } catch {
    return false;
  }
}

/** HMAC-SHA256(body, secret) as lowercase hex, prefixed for wire compatibility with vendor docs. */
export function generateHmacSignature(body: string, secret: string): string {
  const hex = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  return `sha256=${hex}`;
}

/**
 * Verifies `X-RC-Signature` value against the body.
 * Accepts either raw lowercase hex (legacy) or `sha256=<hex>` (preferred).
 */
export function verifyHmacSignature(body: string, signature: string, secret: string): boolean {
  const sig = signature.trim();
  const hexPart = sig.toLowerCase().startsWith("sha256=") ? sig.slice(7).trim() : sig.trim();
  const expectedHex = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  try {
    const a = Buffer.from(expectedHex, "hex");
    const b = Buffer.from(hexPart, "hex");
    if (a.length !== b.length || a.length === 0) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Optional `X-RC-Signature` — HMAC-SHA256 of raw body using the plaintext webhook token as key.
 * When the header is absent, returns true (token-only auth).
 */
export function verifyCadWebhookSignature(
  rawBody: string,
  token: string,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader?.trim()) return true;
  return verifyHmacSignature(rawBody, signatureHeader, token);
}
