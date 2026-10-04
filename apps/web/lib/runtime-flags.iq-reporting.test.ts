import { describe, expect, it, vi } from "vitest";

describe("iQ Reporting UI flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_IQ_REPORTING", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isIqReportingEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_IQ_REPORTING", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isIqReportingEnabled()).toBe(false);
  });
});
