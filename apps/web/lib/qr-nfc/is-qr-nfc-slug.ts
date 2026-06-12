/** Crockford Base32 ULID — 26 chars, used as QR/NFC public id in `/report/{slug}`. */
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

export function isQrNfcSlug(slug: string): boolean {
  return ULID_PATTERN.test(slug.trim());
}
