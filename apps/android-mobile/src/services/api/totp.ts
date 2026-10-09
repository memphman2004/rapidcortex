import { hmac } from '@noble/hashes/hmac';
import { sha1 } from '@noble/hashes/sha1';

/** Decode standard Base32 (RFC 4648) into bytes. */
function base32Decode(input: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = input.replace(/=+$/g, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of cleaned) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** Generate a 6-digit TOTP (SHA-1, 30s step) for a Base32 secret. */
export function generateTotpCode(base32Secret: string, nowMs: number = Date.now()): string {
  const key = base32Decode(base32Secret);
  const counter = Math.floor(nowMs / 1000 / 30);
  const buf = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i -= 1) {
    buf[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const digest = hmac(sha1, key, buf);
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  const otp = binary % 1_000_000;
  return otp.toString().padStart(6, '0');
}
