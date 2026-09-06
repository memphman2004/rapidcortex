import { describe, expect, it, vi } from "vitest";

describe("CAD Connector UI flag", () => {
  it("defaults off when unset and honors explicit enable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CAD_CONNECTOR", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isCadConnectorUiEnabled()).toBe(false);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CAD_CONNECTOR", "1");
    mod = await import("./runtime-flags.js");
    expect(mod.isCadConnectorUiEnabled()).toBe(true);
  });
});
