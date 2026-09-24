import { describe, expect, it, vi } from "vitest";

describe("NexiQ Vision™ UI flags", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_VISION", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isRapidVisionEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_VISION", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isRapidVisionEnabled()).toBe(false);
  }, 20_000);

  it("Nest source defaults on when unset and requires Vision + Nest Connect", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_VISION", "1");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CONNECT_NEST", "1");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_VISION_NEST", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isRapidVisionNestEnabled()).toBe(true);

    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_VISION", "1");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CONNECT_NEST", "1");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_VISION_NEST", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isRapidVisionNestEnabled()).toBe(false);

    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_VISION", "1");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CONNECT_NEST", "0");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_VISION_NEST", "1");
    mod = await import("./runtime-flags.js");
    expect(mod.isRapidVisionNestEnabled()).toBe(false);
  });

  it("Wyze source defaults on when unset and requires Vision + Wyze Connect", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_VISION", "1");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CONNECT_WYZE", "1");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_VISION_WYZE", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isRapidVisionWyzeEnabled()).toBe(true);

    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_VISION", "1");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CONNECT_WYZE", "1");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_VISION_WYZE", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isRapidVisionWyzeEnabled()).toBe(false);

    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_VISION", "1");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CONNECT_WYZE", "0");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_VISION_WYZE", "1");
    mod = await import("./runtime-flags.js");
    expect(mod.isRapidVisionWyzeEnabled()).toBe(false);
  });
});

describe("NexiQ Vision™ Scene Intelligence flags", () => {
  it("defaults on when unset and requires NexiQ Vision", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_VISION", "");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_VISION_AI", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isRapidVisionSceneIntelEnabled()).toBe(true);

    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_VISION", "1");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_VISION_AI", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isRapidVisionSceneIntelEnabled()).toBe(false);

    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_VISION", "0");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_VISION_AI", "1");
    mod = await import("./runtime-flags.js");
    expect(mod.isRapidVisionSceneIntelEnabled()).toBe(false);
  });
});
