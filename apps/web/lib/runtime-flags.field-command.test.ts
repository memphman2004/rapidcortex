import { describe, expect, it, vi } from "vitest";

describe("Field Command UI flag", () => {
  it("defaults on when unset and honors explicit disable", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_FIELD_COMMAND", "");
    let mod = await import("./runtime-flags.js");
    expect(mod.isFieldCommandEnabled()).toBe(true);
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ENABLE_FIELD_COMMAND", "0");
    mod = await import("./runtime-flags.js");
    expect(mod.isFieldCommandEnabled()).toBe(false);
  });
});
