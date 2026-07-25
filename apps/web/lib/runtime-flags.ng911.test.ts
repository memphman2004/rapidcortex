import { describe, expect, it, vi } from "vitest";

describe("NG9-1-1 assist UI flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_NG911_ASSIST", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isNg911AssistEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_NG911_ASSIST", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isNg911AssistEnabled()).toBe(false);
  });
});
