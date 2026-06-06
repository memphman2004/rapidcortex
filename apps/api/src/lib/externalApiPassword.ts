import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Hash Rapid Cortex Agency API client secrets (stored with random salt per client). */
export function hashApiClientSecret(secret: string): { saltHex: string; hashHex: string } {
  const saltHex = randomBytes(16).toString("hex");
  const hashBuf = scryptSync(secret, Buffer.from(saltHex, "utf8"), 64);
  return { saltHex, hashHex: hashBuf.toString("hex") };
}

export function verifyApiClientSecret(secret: string, saltHex: string, hashHex: string): boolean {
  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(secret, Buffer.from(saltHex, "utf8"), 64);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
