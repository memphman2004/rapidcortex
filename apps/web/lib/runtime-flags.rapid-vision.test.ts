import { describe, expect, it, vi } from "vitest";

describe("Rapid Vision™ UI flags", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_VISION", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isRapidVisionEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_VISION", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isRapidVisionEnabled()).toBe(false);
  });
});
