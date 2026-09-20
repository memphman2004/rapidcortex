import { describe, expect, it, vi } from "vitest";

describe("Guest Assist UI flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_GUEST_ASSIST", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isGuestAssistEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_GUEST_ASSIST", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isGuestAssistEnabled()).toBe(false);
  }, 20_000);
});
