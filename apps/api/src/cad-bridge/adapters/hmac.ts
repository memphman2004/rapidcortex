import { createHmac, timingSafeEqual } from "node:crypto";

export function headerValue(headers: Record<string, string | undefined>, name: string): string {
  const needle = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === needle && typeof value === "string") return value;
  }
  return "";
}

export function pickSignatureHeader(headers: Record<string, string | undefined>): string {
  return (
    headerValue(headers, "x-premierone-signature") ||
    headerValue(headers, "x-tyler-signature") ||
    headerValue(headers, "x-centralsquare-signature") ||
    headerValue(headers, "x-hexagon-signature") ||
    headerValue(headers, "x-spillman-signature") ||
    headerValue(headers, "x-cad-signature") ||
    headerValue(headers, "x-signature")
  );
}

/** HMAC-SHA256. Accepts `sha256=<hex>`, `sha256=<base64>`, or raw hex. */
export function validateHmacSha256(rawBody: string, signatureHeader: string, signingSecret: string): boolean {
  if (!signatureHeader || !signingSecret) return false;
  const trimmed = signatureHeader.trim();
  const value = trimmed.toLowerCase().startsWith("sha256=") ? trimmed.slice("sha256=".length) : trimmed;
  const expected = createHmac("sha256", signingSecret).update(rawBody, "utf8").digest();
  const providedHex = Buffer.from(value, "hex");
  if (providedHex.length === expected.length) {
    return timingSafeEqual(providedHex, expected);
  }
  try {
    const providedB64 = Buffer.from(value, "base64");
    if (providedB64.length === expected.length) return timingSafeEqual(providedB64, expected);
  } catch {
    return false;
  }
  return false;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function firstString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return "";
}

export function nestedString(root: Record<string, unknown>, paths: string[][]): string {
  for (const path of paths) {
    let current: unknown = root;
    for (const part of path) {
      current = asRecord(current)[part];
    }
    if (typeof current === "string" && current.trim()) return current;
    if (typeof current === "number") return String(current);
  }
  return "";
}
