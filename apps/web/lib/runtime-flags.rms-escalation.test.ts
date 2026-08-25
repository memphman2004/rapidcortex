import { describe, expect, it, vi } from "vitest";

describe("RMS and Escalation UI flags", () => {
  it("defaults RMS on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RMS", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isRmsUiEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RMS", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isRmsUiEnabled()).toBe(false);
  });

  it("defaults Escalation on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_ESCALATION", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isEscalationUiEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_ESCALATION", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isEscalationUiEnabled()).toBe(false);
  });
});
