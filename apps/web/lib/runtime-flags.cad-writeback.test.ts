import { afterEach, describe, expect, it, vi } from "vitest";

describe("runtime feature flags", { timeout: 20_000 }, () => {
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

  it("keeps Scenario Center off unless explicitly enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_PILOT_TEST_MODE", "1");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_SCENARIO_CENTER", "");
    const { isScenarioCenterUiEnabled } = await import("./runtime-flags");
    expect(isScenarioCenterUiEnabled()).toBe(false);
  });

  it("enables Scenario Center only when explicitly set", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_SCENARIO_CENTER", "1");
    const { isScenarioCenterUiEnabled } = await import("./runtime-flags");
    expect(isScenarioCenterUiEnabled()).toBe(true);
  });

  it("keeps CAD write-back off unless explicitly enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_PILOT_TEST_MODE", "1");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CAD_WRITEBACK", "");
    const { isCadWritebackUiEnabled, isCadNatureMappingUiEnabled } = await import("./runtime-flags");
    expect(isCadWritebackUiEnabled()).toBe(false);
    expect(isCadNatureMappingUiEnabled()).toBe(true);
  });

  it("enables CAD write-back only when explicitly set", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CAD_WRITEBACK", "1");
    const { isCadWritebackUiEnabled } = await import("./runtime-flags");
    expect(isCadWritebackUiEnabled()).toBe(true);
  });

  it("defaults CAD Bridge admin on when unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_PILOT_TEST_MODE", "0");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_CAD_BRIDGE", "");
    const { isCadBridgeUiEnabled } = await import("./runtime-flags");
    expect(isCadBridgeUiEnabled()).toBe(true);
  });

  it("defaults C2C hub UI on when unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_PILOT_TEST_MODE", "0");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_C2C_HUB", "");
    const { isC2cHubUiEnabled } = await import("./runtime-flags");
    expect(isC2cHubUiEnabled()).toBe(true);
  });

  it("honors explicit disable for operational flags", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_REPORTS", "0");
    const { isReportsEnabled } = await import("./runtime-flags");
    expect(isReportsEnabled()).toBe(false);
  });

  it("defaults live STT capture on when unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_PILOT_TEST_MODE", "0");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_LIVE_STT", "");
    const { isLiveSttCaptureEnabled } = await import("./runtime-flags");
    expect(isLiveSttCaptureEnabled()).toBe(true);
  });

  it("defaults live video UI on when unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_PILOT_TEST_MODE", "0");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_LIVE_VIDEO", "");
    const { isLiveVideoEnabled } = await import("./runtime-flags");
    expect(isLiveVideoEnabled()).toBe(true);
  });
});
