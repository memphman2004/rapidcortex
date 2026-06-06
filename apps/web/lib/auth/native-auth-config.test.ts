import { afterEach, describe, expect, it } from "vitest";
import {
  getNativeAuthConfig,
  isAllowedNativeRedirectUri,
} from "@/lib/auth/nativeAuthConfig";
import { buildNativeTokenExchangeParams } from "@/lib/auth/native-token-exchange";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("native auth config", () => {
  it("throws when required config is missing", () => {
    delete process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
    delete process.env.COGNITO_DOMAIN;
    delete process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
    delete process.env.COGNITO_CLIENT_ID;
    expect(() => getNativeAuthConfig()).toThrow();
  });

  it("loads and normalizes configured values", () => {
    process.env.NEXT_PUBLIC_COGNITO_DOMAIN = "example.auth.us-east-1.amazoncognito.com";
    process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = "abc123";
    process.env.NEXT_PUBLIC_COGNITO_REGION = "us-east-1";
    const config = getNativeAuthConfig();
    expect(config.cognitoDomain).toBe("https://example.auth.us-east-1.amazoncognito.com");
    expect(config.authorizeEndpoint).toContain("/oauth2/authorize");
    expect(config.codeChallengeMethod).toBe("S256");
  });

  it("validates native redirect allowlist", () => {
    expect(isAllowedNativeRedirectUri("rapidcortex://oauth/callback")).toBe(true);
    expect(isAllowedNativeRedirectUri("https://evil.example/callback")).toBe(false);
  });

  it("builds expected token exchange shape", () => {
    const body = buildNativeTokenExchangeParams({
      clientId: "client",
      code: "auth-code",
      redirectUri: "rapidcortex://oauth/callback",
      codeVerifier: "verifier",
    });
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("client_id")).toBe("client");
    expect(body.get("code")).toBe("auth-code");
    expect(body.get("redirect_uri")).toBe("rapidcortex://oauth/callback");
    expect(body.get("code_verifier")).toBe("verifier");
  });
});
