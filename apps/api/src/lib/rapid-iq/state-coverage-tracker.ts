import type { Jurisdiction, StateCoverage } from "./jurisdiction-registry.js";

/** 4 days — boost Tier 3 before the 5-day coverage deadline. */
export const STATE_COVERAGE_THRESHOLD_HOURS = 96;
export const STATE_COVERAGE_BOOST = 5.0;

export type StateCoverageReader = {
  getAllStateCoverage: () => Promise<StateCoverage[]>;
};

export async function applyStateCoverageBoosts(
  jurisdictions: Jurisdiction[],
  repo: StateCoverageReader,
  nowMs = Date.now(),
): Promise<Jurisdiction[]> {
  const coverage = await repo.getAllStateCoverage();
  const boostedStates = new Set<string>();

  for (const state of coverage) {
    if (!state.lastScannedAt) {
      boostedStates.add(state.stateCode);
      continue;
    }
    const hours = (nowMs - new Date(state.lastScannedAt).getTime()) / (1000 * 60 * 60);
    if (hours >= STATE_COVERAGE_THRESHOLD_HOURS) {
      boostedStates.add(state.stateCode);
      console.log(
        JSON.stringify({
          msg: "rapid_iq_state_coverage_boost",
          stateCode: state.stateCode,
          hoursSinceScan: Math.round(hours),
        }),
      );
    }
  }

  if (boostedStates.size === 0) return jurisdictions;

  return jurisdictions.map((j) =>
    boostedStates.has(j.stateCode) && j.tier === 3
      ? { ...j, priorityBoost: STATE_COVERAGE_BOOST }
      : j,
  );
}
