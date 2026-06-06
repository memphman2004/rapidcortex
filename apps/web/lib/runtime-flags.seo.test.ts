import { describe, expect, it, vi } from "vitest";

describe("SEO Intelligence UI flag", () => {
  it("is off unless NEXT_PUBLIC_ENABLE_SEO_INTELLIGENCE=1", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_SEO_INTELLIGENCE", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isSeoIntelligenceUiEnabled()).toBe(false);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_SEO_INTELLIGENCE", "1");
    mod = await import("./runtime-flags.js");
    expect(mod.isSeoIntelligenceUiEnabled()).toBe(true);
  });
});
