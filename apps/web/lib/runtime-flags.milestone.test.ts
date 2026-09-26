import { describe, expect, it, vi } from "vitest";

describe("Milestone XProtect UI flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_MILESTONE_XPROTECT", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isMilestoneXprotectEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_MILESTONE_XPROTECT", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isMilestoneXprotectEnabled()).toBe(false);
  }, 20_000);
});
