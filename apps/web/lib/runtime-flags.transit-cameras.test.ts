import { describe, expect, it, vi } from "vitest";

describe("Transit cameras UI flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_TRANSIT_CAMERAS", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isTransitCamerasUiEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_TRANSIT_CAMERAS", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isTransitCamerasUiEnabled()).toBe(false);
  });
});
