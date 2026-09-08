import { describe, expect, it, vi } from "vitest";

describe("Clery Act module UI flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CLERY_MODULE", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isCleryModuleEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CLERY_MODULE", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isCleryModuleEnabled()).toBe(false);
  });
});
