import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isMobileOperationalAuthBlockingEnabled,
  isMobileUserAgent,
  isTabletUserAgent,
  shouldBlockAuthOnDevice,
} from "../isMobileRequest";

describe("isTabletUserAgent", () => {
  it("detects iPad UA", () => {
    expect(
      isTabletUserAgent(
        "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(true);
  });

  it("detects Android without Mobile token as tablet heuristic", () => {
    expect(
      isTabletUserAgent(
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ),
    ).toBe(true);
  });
});

describe("isMobileUserAgent", () => {
  it("detects iPhone", () => {
    expect(isMobileUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15")).toBe(
      true,
    );
  });

  it("detects Android mobile Chrome", () => {
    expect(
      isMobileUserAgent(
        "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe(true);
  });

  it("detects Firefox Mobile", () => {
    expect(
      isMobileUserAgent(
        "Mozilla/5.0 (Android 11; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0",
      ),
    ).toBe(true);
  });

  it("detects Samsung Internet mobile", () => {
    expect(
      isMobileUserAgent(
        "Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S901B) AppleWebKit/537.36 SamsungBrowser/21.0 Chrome/115.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe(true);
  });

  it("does not classify Windows desktop Chrome as phone", () => {
    expect(
      isMobileUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ),
    ).toBe(false);
  });

  it("does not classify macOS desktop Safari as phone", () => {
    expect(
      isMobileUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
      ),
    ).toBe(false);
  });
});

describe("shouldBlockAuthOnDevice", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows desktop when blocking is explicitly off", () => {
    vi.stubEnv("DISABLE_MOBILE_AUTH", "false");
    expect(shouldBlockAuthOnDevice("Mozilla/5.0 (Windows NT 10.0) Chrome/119.0")).toBe(false);
  });

  it("blocks iPhone when blocking is explicitly on", () => {
    vi.stubEnv("DISABLE_MOBILE_AUTH", "true");
    expect(shouldBlockAuthOnDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile")).toBe(true);
  });

  it("blocks iPad when BLOCK_TABLET_AUTH defaults strict", () => {
    vi.stubEnv("DISABLE_MOBILE_AUTH", "true");
    expect(
      shouldBlockAuthOnDevice(
        "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1",
      ),
    ).toBe(true);
  });

  it("allows iPad-like UA when BLOCK_TABLET_AUTH=false", () => {
    vi.stubEnv("DISABLE_MOBILE_AUTH", "true");
    vi.stubEnv("BLOCK_TABLET_AUTH", "false");
    expect(
      shouldBlockAuthOnDevice(
        "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1",
      ),
    ).toBe(false);
  });

  it("empty user-agent blocked in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DISABLE_MOBILE_AUTH", "true");
    expect(shouldBlockAuthOnDevice("")).toBe(true);
    expect(shouldBlockAuthOnDevice(undefined)).toBe(true);
  });

  it("empty user-agent allowed in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DISABLE_MOBILE_AUTH", "true");
    expect(shouldBlockAuthOnDevice("")).toBe(false);
    expect(isMobileOperationalAuthBlockingEnabled()).toBe(true);
  });

  it("DISABLE_MOBILE_AUTH unset defaults blocking on in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isMobileOperationalAuthBlockingEnabled()).toBe(true);
  });

  it("DISABLE_MOBILE_AUTH unset defaults off in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isMobileOperationalAuthBlockingEnabled()).toBe(false);
  });
});
