import { createHash } from "node:crypto";

/** Normalize to E.164 for stable hashing and routing keys. */
export function normalizePhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

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
