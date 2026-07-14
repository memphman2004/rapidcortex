import { describe, expect, it, vi } from "vitest";

describe("Sales Leads UI flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_SALES_LEADS", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isSalesLeadsUiEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_SALES_LEADS", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isSalesLeadsUiEnabled()).toBe(false);
  });
});
