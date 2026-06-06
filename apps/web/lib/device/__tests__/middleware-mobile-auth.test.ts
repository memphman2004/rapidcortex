import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { getMobileOperationalAuthMiddlewareResponse } from "../middleware-mobile-auth";

describe("getMobileOperationalAuthMiddlewareResponse", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DISABLE_MOBILE_AUTH", "true");
    vi.stubEnv("BLOCK_TABLET_AUTH", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const iphoneUa =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

  function req(pathname: string, ua: string) {
    return new NextRequest(new URL(`https://example.com${pathname}`), {
      headers: { "user-agent": ua },
    });
  }

  it("redirects /login from iPhone", () => {
    const res = getMobileOperationalAuthMiddlewareResponse(req("/login", iphoneUa));
    expect(res?.status).toBe(307);
    expect(res?.headers.get("location")).toContain("/mobile-access-restricted");
  });

  it("redirects /auth/native-login from Android mobile", () => {
    const android =
      "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 Chrome/118.0.0.0 Mobile Safari/537.36";
    const res = getMobileOperationalAuthMiddlewareResponse(req("/auth/native-login", android));
    expect(res?.status).toBe(307);
    expect(res?.headers.get("location")).toContain("/mobile-access-restricted");
  });

  it("allows / from mobile marketing", () => {
    expect(getMobileOperationalAuthMiddlewareResponse(req("/", iphoneUa))).toBeNull();
  });

  it("allows /contact-sales from Android mobile", () => {
    const android =
      "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 Chrome/118.0.0.0 Mobile Safari/537.36";
    expect(getMobileOperationalAuthMiddlewareResponse(req("/contact-sales", android))).toBeNull();
  });

  it("allows /book-demo from mobile", () => {
    const android =
      "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 Chrome/118.0.0.0 Mobile Safari/537.36";
    expect(getMobileOperationalAuthMiddlewareResponse(req("/book-demo", android))).toBeNull();
  });

  it("redirects /dashboard from iPhone", () => {
    const res = getMobileOperationalAuthMiddlewareResponse(req("/dashboard", iphoneUa));
    expect(res?.status).toBe(307);
    expect(res?.headers.get("location")).toContain("/mobile-access-restricted");
  });

  it("403 JSON for mobile /api/auth/session", () => {
    const res = getMobileOperationalAuthMiddlewareResponse(req("/api/auth/session", iphoneUa));
    expect(res?.status).toBe(403);
  });

  it("allows desktop operational BFF proxy path", () => {
    const desktopUa =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
    expect(
      getMobileOperationalAuthMiddlewareResponse(req("/api/backend/proxy/demo", desktopUa)),
    ).toBeNull();
  });

  it("403 JSON for mobile non-public /api/backend path", () => {
    const res = getMobileOperationalAuthMiddlewareResponse(req("/api/backend/proxy/demo", iphoneUa));
    expect(res?.status).toBe(403);
    expect(res?.headers.get("content-type")).toContain("application/json");
  });

  it("allows mobile /api/health", () => {
    expect(getMobileOperationalAuthMiddlewareResponse(req("/api/health/web", iphoneUa))).toBeNull();
  });
});
