import { describe, expect, it, vi } from "vitest";

describe("NexiQ Video UI flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RC_VIDEO", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isRcVideoEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RC_VIDEO", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isRcVideoEnabled()).toBe(false);
  }, 20_000);
});
