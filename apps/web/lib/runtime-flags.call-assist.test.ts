import { describe, expect, it, vi } from "vitest";

describe("Call Assist UI flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CALL_ASSIST", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isCallAssistEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CALL_ASSIST", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isCallAssistEnabled()).toBe(false);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CALL_ASSIST_GREETING_CONFIG", "");
    mod = await import("./runtime-flags.js");
    expect(mod.isCallAssistGreetingConfigEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CALL_ASSIST_GREETING_CONFIG", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isCallAssistGreetingConfigEnabled()).toBe(false);
  });
});
