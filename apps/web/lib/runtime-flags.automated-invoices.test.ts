import { describe, expect, it, vi } from "vitest";

describe("Automated invoices UI flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_AUTOMATED_INVOICES", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isAutomatedInvoicesEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_AUTOMATED_INVOICES", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isAutomatedInvoicesEnabled()).toBe(false);
  }, 20_000);
});
