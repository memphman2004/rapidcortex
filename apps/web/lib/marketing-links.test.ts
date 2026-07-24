import { afterEach, describe, expect, it, vi } from "vitest";
import {
  marketingHomePath,
  marketingOperationsStatusPath,
  marketingPricingPath,
} from "@/lib/marketing-links";

describe("marketingOperationsStatusPath", () => {
  it("links in-app Status to /status", () => {
    expect(marketingOperationsStatusPath()).toBe("/status");
  });
});

describe("marketingHomePath / marketingPricingPath", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses relative paths when app origin is unset (same-host)", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", "");
    vi.stubEnv("NEXT_PUBLIC_MARKETING_SITE_URL", "");
    expect(marketingHomePath()).toBe("/");
    expect(marketingPricingPath()).toBe("/pricing");
  });

  it("points at www when app origin is set (split hosting)", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", "https://app.rapidcortex.us");
    vi.stubEnv("NEXT_PUBLIC_MARKETING_SITE_URL", "https://www.rapidcortex.us");
    expect(marketingHomePath()).toBe("https://www.rapidcortex.us/");
    expect(marketingPricingPath()).toBe("https://www.rapidcortex.us/pricing");
  });
});
