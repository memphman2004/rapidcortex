import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashRcLiteApiKey, verifyRcLiteApiKey } from "./hash-api-key";

describe("hashRcLiteApiKey", () => {
  it("only accepts raw payloads after hashing", () => {
    const secret = `rk_hmac_${randomUUID()}`;
    const hashed = hashRcLiteApiKey(secret);
    expect(verifyRcLiteApiKey(secret, hashed)).toBe(true);
    expect(verifyRcLiteApiKey(`${secret}a`, hashed)).toBe(false);
  });
});
