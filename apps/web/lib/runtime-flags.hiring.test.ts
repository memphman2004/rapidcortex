import { afterEach, describe, expect, it, vi } from "vitest";

describe("isHiringUiEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults on when unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_HIRING", "");
    const mod = await import("./runtime-flags");
    expect(mod.isHiringUiEnabled()).toBe(true);
  });

  it("disables when explicitly off", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_HIRING", "0");
    const mod = await import("./runtime-flags");
    expect(mod.isHiringUiEnabled()).toBe(false);
  });
});
