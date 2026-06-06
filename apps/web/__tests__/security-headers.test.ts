import { describe, expect, it } from "vitest";
import nextConfig from "../next.config.mjs";

describe("security headers config", () => {
  it("returns strict security headers including CSP report-only", async () => {
    const entries = await nextConfig.headers?.();
    expect(entries).toBeDefined();
    expect(entries?.length).toBeGreaterThan(0);

    const root = entries?.find((e: { source: string }) => e.source === "/:path*");
    expect(root).toBeDefined();
    const headerMap = new Map((root?.headers ?? []).map((h: { key: string; value: string }) => [h.key, h.value]));

    expect(headerMap.has("Content-Security-Policy-Report-Only")).toBe(true);
    expect(headerMap.has("Content-Security-Policy")).toBe(false);
    expect(headerMap.get("X-Frame-Options")).toBe("DENY");
    expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headerMap.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headerMap.get("Permissions-Policy")).toBe("geolocation=(), microphone=(), camera=()");

    const csp = headerMap.get("Content-Security-Policy-Report-Only") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("frame-src 'self'");
    expect(csp).toContain("https://www.youtube-nocookie.com");
    expect(csp).toContain("media-src 'self' https://www.youtube-nocookie.com");
    expect(csp).toContain("report-uri /api/csp-report");
  });
});
