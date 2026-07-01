import { createHash } from "node:crypto";
import { normalizePhoneE164 } from "rapid-cortex-shared";

export { normalizePhoneE164 };

/** Normalize to digits-only E.164-ish form for stable hashing. */
export function normalizePhoneDigits(phone: string): string {
  return normalizePhoneE164(phone).replace(/\D/g, "");
}

export function hashPhoneSha256(phone: string): string {
  const normalized = normalizePhoneDigits(phone);
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

/** Dispatcher-safe display: `***-***-1234`. */
export function maskPhoneLast4(phone: string): string {
  const digits = normalizePhoneDigits(phone);
  const last4 = digits.slice(-4);
  return `***-***-${last4}`;
}
