import { describe, expect, it, vi } from "vitest";

describe("Pre-Arrival iQ flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_PRE_ARRIVAL_IQ", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isPreArrivalIqEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_PRE_ARRIVAL_IQ", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isPreArrivalIqEnabled()).toBe(false);
  }, 15_000);
});
