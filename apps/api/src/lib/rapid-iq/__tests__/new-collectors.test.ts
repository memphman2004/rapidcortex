import { afterEach, describe, expect, it, vi } from "vitest";

describe("runLegislatureCollector", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("skips gracefully when RAPID_IQ_LEGISCAN_API_KEY is unset", async () => {
    vi.stubEnv("RAPID_IQ_LEGISCAN_API_KEY", "");
    const { runLegislatureCollector } = await import(
      "../../../handlers/rapid-iq/collectors/legislature-collector.js"
    );
    const result = await runLegislatureCollector();
    expect(result).toEqual({ signalsFound: 0 });
  });
});

describe("selectE911OfficesForRun", () => {
  it("returns a non-empty rotating subset", async () => {
    const { selectE911OfficesForRun, STATE_E911_COORDINATORS, E911_OFFICES_PER_RUN } =
      await import("../state-e911-coordinators.js");
    const selected = selectE911OfficesForRun(STATE_E911_COORDINATORS, new Date("2026-08-09T12:00:00Z"));
    expect(selected.length).toBe(E911_OFFICES_PER_RUN);
    expect(selected.every((o) => o.stateCode && o.url)).toBe(true);
  });
});

describe("SOURCE_SCORE_BOOSTS", () => {
  it("ranks FEMA and NTIA above legislature", async () => {
    const { SOURCE_SCORE_BOOSTS } = await import("../opportunity-scorer.js");
    expect(SOURCE_SCORE_BOOSTS.femaGrantAward).toBe(20);
    expect(SOURCE_SCORE_BOOSTS.ntiaGrant).toBe(22);
    expect(SOURCE_SCORE_BOOSTS.stateLegislatureBill).toBe(15);
    expect(SOURCE_SCORE_BOOSTS.e911CoordinatorReport).toBe(18);
  });
});
