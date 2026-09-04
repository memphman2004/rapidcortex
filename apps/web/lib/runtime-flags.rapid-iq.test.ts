import { describe, expect, it, vi } from "vitest";

describe("Rapid IQ UI flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_IQ", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isRapidIqUiEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_IQ", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isRapidIqUiEnabled()).toBe(false);
  });

  it("intel UI defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_IQ_INTEL", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isRapidIqIntelUiEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_IQ_INTEL", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isRapidIqIntelUiEnabled()).toBe(false);
  });

  it("conferences UI defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CONFERENCES", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isConferencesUiEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CONFERENCES", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isConferencesUiEnabled()).toBe(false);
  });
});
