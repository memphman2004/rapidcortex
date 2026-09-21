import { describe, expect, it, vi } from "vitest";

describe("Map education overlay UI flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_MAP_EDUCATION", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isMapEducationEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_MAP_EDUCATION", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isMapEducationEnabled()).toBe(false);
  }, 20_000);
});
