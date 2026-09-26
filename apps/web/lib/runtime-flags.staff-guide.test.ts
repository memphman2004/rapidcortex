import { describe, expect, it, vi } from "vitest";

describe("Staff Guide UI flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_STAFF_GUIDE", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isStaffGuideEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_STAFF_GUIDE", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isStaffGuideEnabled()).toBe(false);
  }, 20_000);
});
