import { describe, expect, it, vi } from "vitest";

describe("RC Translate UI flags", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RC_TRANSLATE", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isRcTranslateEnabled()).toBe(true);
    expect(mod.isRcTranslateVenueEnabled()).toBe(true);
    expect(mod.isRcTranslateHospitalEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_RC_TRANSLATE", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isRcTranslateEnabled()).toBe(false);
  });
});
