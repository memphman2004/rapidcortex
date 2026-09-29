import { describe, expect, it, vi } from "vitest";

describe("NexiQ UI flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_IQ", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isNexiQUiEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_IQ", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isNexiQUiEnabled()).toBe(false);
  });

  it("intel UI defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_IQ_INTEL", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isNexiQIntelUiEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RAPID_IQ_INTEL", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isNexiQIntelUiEnabled()).toBe(false);
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

  it("sales automation UI defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_SALES_AUTOMATION", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isSalesAutomationUiEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_SALES_AUTOMATION", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isSalesAutomationUiEnabled()).toBe(false);
  });
});
