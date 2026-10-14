import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/env.js", () => ({
  env: {
    campusAlertsPhoneHmacSecret: "campus-alerts-test-hmac-secret-do-not-use-prod",
    campusAlertsPhoneHmacSecretArn: "",
    campusAlertsPhoneEncSecret: "campus-alerts-test-enc-secret-do-not-use-prod",
    campusAlertsPhoneEncSecretArn: "",
    externalApiEncryptionKeyInline: "",
    externalApiEncryptionKeyArn: "",
    deploymentStage: "staging",
  },
}));

vi.mock("../../lib/runtimeSecrets.js", () => ({
  resolvePlainOrSecretArn: async (plain: string) => plain?.trim() ?? "",
}));

describe("campus-alerts-crypto", () => {
  let crypto: typeof import("./campus-alerts-crypto.js");

  beforeAll(async () => {
    crypto = await import("./campus-alerts-crypto.js");
  });

  it("generates 6-digit OTP", () => {
    const code = crypto.generateSixDigitOtp();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("hashes OTP without storing plaintext", () => {
    const h = crypto.hashCampusAlertsOtp("123456", "chal_1", "pepper");
    expect(h).toHaveLength(64);
    expect(h).not.toContain("123456");
  });

  it("uses tenant-scoped HMAC digests (agency isolation)", async () => {
    const a = await crypto.campusAlertsPhoneLookupDigest("agency-a", "+15551234567");
    const b = await crypto.campusAlertsPhoneLookupDigest("agency-b", "+15551234567");
    expect(a).not.toEqual(b);
    expect(a).toHaveLength(64);
  });

  it("round-trips phone encryption", async () => {
    const enc = await crypto.encryptCampusAlertsPhone("+15551234567");
    expect(enc).not.toContain("555");
    const dec = await crypto.decryptCampusAlertsPhone(enc);
    expect(dec).toBe("+15551234567");
  });
});
