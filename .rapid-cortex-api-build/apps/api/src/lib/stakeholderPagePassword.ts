import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Store as `saltHex:hashHex` in DynamoDB. */
export function hashStakeholderPagePassword(password: string): string {
  const saltHex = randomBytes(16).toString("hex");
  const hashBuf = scryptSync(password, Buffer.from(saltHex, "utf8"), 64);
  return `${saltHex}:${hashBuf.toString("hex")}`;
}

export function verifyStakeholderPagePassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(password, Buffer.from(saltHex, "utf8"), 64);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
