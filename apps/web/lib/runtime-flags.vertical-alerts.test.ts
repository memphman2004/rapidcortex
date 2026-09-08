import { describe, expect, it, vi } from "vitest";

describe("Vertical alerts UI flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_VERTICAL_ALERTS", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isVerticalAlertsEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_VERTICAL_ALERTS", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isVerticalAlertsEnabled()).toBe(false);
  });

  it("keeps physical security commands off unless explicitly enabled", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_PHYSICAL_SECURITY_COMMANDS", "");
    const mod = await import("./runtime-flags.js");
    expect(mod.isPhysicalSecurityCommandsEnabled()).toBe(false);
  });

  it("defaults physical security ingest on when unset", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_PHYSICAL_SECURITY_INGEST", "");
    const mod = await import("./runtime-flags.js");
    expect(mod.isPhysicalSecurityIngestEnabled()).toBe(true);
  });
});
