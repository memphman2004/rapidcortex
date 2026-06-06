import { describe, expect, it, vi, afterEach } from "vitest";
import {
  getNativeOAuthClientId,
  isAllowedNativeAppCallbackUri,
  isAllowedNativeAuthorizeRedirectUri,
  isAllowedNativeLogoutUri,
  nativeOAuthReturnToAppUrl,
} from "@/lib/auth/nativeAuthConfig";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("nativeAuthConfig", () => {
  it("allows rapidcortex primary redirect", () => {
    expect(isAllowedNativeAuthorizeRedirectUri("rapidcortex://oauth/callback")).toBe(true);
  });

  it("resolves client id from runtime COGNITO_CLIENT_ID when NEXT_PUBLIC is empty", () => {
    vi.stubEnv("NEXT_PUBLIC_COGNITO_CLIENT_ID", "");
    vi.stubEnv("COGNITO_CLIENT_ID", "runtime-client-id");
    expect(getNativeOAuthClientId()).toBe("runtime-client-id");
  });

  it("allows platform-specific redirect URIs", () => {
    expect(isAllowedNativeAuthorizeRedirectUri("rapidcortex-desktop://oauth/callback")).toBe(true);
    expect(isAllowedNativeAppCallbackUri("rapidcortex-desktop://auth/callback")).toBe(true);
    expect(isAllowedNativeAuthorizeRedirectUri("rapidcortex-ios://oauth/callback")).toBe(true);
    expect(isAllowedNativeAuthorizeRedirectUri("rapidcortex-windows://oauth/callback")).toBe(true);
  });

  it("allows com.rapidcortex.desktop callback URIs for macOS", () => {
    expect(isAllowedNativeAppCallbackUri("com.rapidcortex.desktop://oauth")).toBe(true);
    expect(isAllowedNativeAppCallbackUri("com.rapidcortex.desktop://oauth/callback")).toBe(true);
    expect(isAllowedNativeAuthorizeRedirectUri("com.rapidcortex.desktop://oauth/callback")).toBe(true);
  });

  it("rejects https URLs as app_callback", () => {
    expect(isAllowedNativeAppCallbackUri("https://www.rapidcortex.us/auth/return-to-app")).toBe(false);
  });

  it("rejects unknown redirect URIs", () => {
    expect(isAllowedNativeAuthorizeRedirectUri("https://evil.example/callback")).toBe(false);
    expect(isAllowedNativeAuthorizeRedirectUri("rapidcortex://evil")).toBe(false);
  });

  it("allows HTTPS return-to-app when NEXT_PUBLIC_SITE_URL matches", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.rapidcortex.us");
    const u = nativeOAuthReturnToAppUrl();
    expect(u).toBe("https://www.rapidcortex.us/auth/return-to-app");
    expect(isAllowedNativeAuthorizeRedirectUri(u!)).toBe(true);
  });

  it("allows native logout URIs", () => {
    expect(isAllowedNativeLogoutUri("rapidcortex://logout/callback")).toBe(true);
    expect(isAllowedNativeLogoutUri("https://wrong")).toBe(false);
  });
});
