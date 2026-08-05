import { describe, expect, it, vi } from "vitest";

describe("PSAP Prospects UI flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_PSAP_PROSPECTS", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isPsapProspectsUiEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_PSAP_PROSPECTS", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isPsapProspectsUiEnabled()).toBe(false);
  });
});
