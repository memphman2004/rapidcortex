import { describe, expect, it } from "vitest";
import { buildRapidCortexTotpOtpauthUrl } from "./totp-otpauth";

describe("buildRapidCortexTotpOtpauthUrl", () => {
  it("encodes a Google Authenticator-compatible Rapid Cortex account", () => {
    const url = buildRapidCortexTotpOtpauthUrl("dispatcher@agency.gov", "JBSWY3DPEHPK3PXP");
    expect(url.startsWith("otpauth://totp/")).toBe(true);
    expect(url).toContain("Rapid%20Cortex");
    expect(url).toContain("dispatcher%40agency.gov");
    expect(url).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(url).toContain("issuer=Rapid%20Cortex");
    expect(url).toContain("digits=6");
    expect(url).toContain("period=30");
  });
});
