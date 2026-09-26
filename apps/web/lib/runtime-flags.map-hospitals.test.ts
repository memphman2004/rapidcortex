import { describe, expect, it, vi } from "vitest";

describe("Map hospitals overlay flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_MAP_HOSPITALS", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isMapHospitalsEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_MAP_HOSPITALS", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isMapHospitalsEnabled()).toBe(false);
  }, 15_000);
});
