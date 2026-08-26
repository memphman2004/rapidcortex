import { describe, expect, it, vi } from "vitest";

describe("Venue operational awareness UI flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_VENUE_OPERATIONAL_AWARENESS", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isVenueOperationalAwarenessEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_VENUE_OPERATIONAL_AWARENESS", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isVenueOperationalAwarenessEnabled()).toBe(false);
  });
});

describe("Campus operational map UI flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CAMPUS_OPERATIONAL_MAP", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isCampusOperationalMapEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CAMPUS_OPERATIONAL_MAP", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isCampusOperationalMapEnabled()).toBe(false);
  });
});
