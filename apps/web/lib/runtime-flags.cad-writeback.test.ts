import { afterEach, describe, expect, it, vi } from "vitest";

describe("runtime feature flags", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults operational flags on when unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_PILOT_TEST_MODE", "0");
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_QA_SCORING", "");
    const { isQaScoringEnabled } = await import("./runtime-flags");
    expect(isQaScoringEnabled()).toBe(true);
  });

  it("keeps CAD write-back off unless explicitly enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_PILOT_TEST_MODE", "1");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CAD_WRITEBACK", "");
    const { isCadWritebackUiEnabled } = await import("./runtime-flags");
    expect(isCadWritebackUiEnabled()).toBe(false);
  });

  it("enables CAD write-back only when explicitly set", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CAD_WRITEBACK", "1");
    const { isCadWritebackUiEnabled } = await import("./runtime-flags");
    expect(isCadWritebackUiEnabled()).toBe(true);
  });

  it("honors explicit disable for operational flags", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_REPORTS", "0");
    const { isReportsEnabled } = await import("./runtime-flags");
    expect(isReportsEnabled()).toBe(false);
  });
});
