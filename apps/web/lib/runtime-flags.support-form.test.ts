import { describe, expect, it, vi } from "vitest";

describe("Support form UI flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_SUPPORT_FORM", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isSupportFormUiEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_SUPPORT_FORM", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isSupportFormUiEnabled()).toBe(false);
  }, 20_000);
});
