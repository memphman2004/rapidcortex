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

  it("transcript flag defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_VISION", "1");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_VISION_TRANSCRIPT", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isRapidVisionTranscriptEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_VISION", "1");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_VISION_TRANSCRIPT", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isRapidVisionTranscriptEnabled()).toBe(false);
  });
});
