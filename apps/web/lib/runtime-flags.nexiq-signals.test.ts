import { describe, expect, it, vi } from "vitest";

describe("NexiQ Signals UI flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_NEXIQ_SIGNALS", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isNexiqSignalsUiEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_NEXIQ_SIGNALS", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isNexiqSignalsUiEnabled()).toBe(false);
  });
});
