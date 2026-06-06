import { createHash, timingSafeEqual } from "node:crypto";

const PREFIX = "rc_lite_sdk_v1:";

/** Stored representation for Dynamo rows — NEVER store raw plaintext keys beyond first display. */

export function hashRcLiteApiKey(raw: string): string {
  return createHash("sha256").update(`${PREFIX}${raw}`).digest("hex");
}

export function verifyRcLiteApiKey(raw: string, storedHashHex: string): boolean {
  const expectedHex = hashRcLiteApiKey(raw);
  try {
    return timingSafeEqual(Buffer.from(expectedHex, "hex"), Buffer.from(storedHashHex.toLowerCase(), "hex"));
  } catch {
    return false;
  }
}
