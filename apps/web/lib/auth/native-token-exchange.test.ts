import { describe, expect, it } from "vitest";
import { buildNativeTokenExchangeParams } from "@/lib/auth/native-token-exchange";

describe("native token exchange", () => {
  it("builds Cognito token exchange form body", () => {
    const p = buildNativeTokenExchangeParams({
      clientId: "abc123",
      code: "the-code",
      redirectUri: "rapidcortex://oauth/callback",
      codeVerifier: "verifier",
    });
    expect(p.get("grant_type")).toBe("authorization_code");
    expect(p.get("client_id")).toBe("abc123");
    expect(p.get("code")).toBe("the-code");
    expect(p.get("redirect_uri")).toBe("rapidcortex://oauth/callback");
    expect(p.get("code_verifier")).toBe("verifier");
  });
});
