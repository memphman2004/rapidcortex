import { describe, expect, it, vi } from "vitest";

describe("SEO Intelligence UI flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_SEO_INTELLIGENCE", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isSeoIntelligenceUiEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_SEO_INTELLIGENCE", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isSeoIntelligenceUiEnabled()).toBe(false);
  });
});
