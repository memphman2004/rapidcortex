import { describe, expect, it, vi } from "vitest";

describe("Deployments map UI flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEPLOYMENTS_MAP", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isDeploymentsMapEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEPLOYMENTS_MAP", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isDeploymentsMapEnabled()).toBe(false);
  });
});
