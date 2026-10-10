import { describe, expect, it, vi } from "vitest";

describe("GIS Intelligence flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_GIS", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isGisEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_GIS", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isGisEnabled()).toBe(false);
  }, 15_000);
});
