import { describe, expect, it } from "vitest";
import { hydrateJurisdiction, type JurisdictionSeed } from "../jurisdiction-registry.js";
import {
  applyVenueSeasonalBoost,
  computePriorityScore,
  NEVER_SCANNED_PRIORITY,
  selectJurisdictionsForRun,
} from "../jurisdiction-scheduler.js";
import { applyStateCoverageBoosts, STATE_COVERAGE_BOOST } from "../state-coverage-tracker.js";
import { isWithinCollectionWindow } from "../../../handlers/rapid-iq/collectors/orchestrator.js";
import { runAgendaCollector } from "../../../handlers/rapid-iq/collectors/agenda-collector.js";

function seed(partial: Partial<JurisdictionSeed> & Pick<JurisdictionSeed, "jurisdictionId" | "tier">): JurisdictionSeed {
  return {
    type: "county",
    name: partial.name ?? partial.jurisdictionId,
    stateCode: partial.stateCode ?? "GA",
    stateName: partial.stateName ?? "Georgia",
    population: partial.population ?? 50_000,
    tierWeight: partial.tier === 0 ? 4 : partial.tier === 1 ? 3 : partial.tier === 2 ? 2 : 1,
    intervalHours: partial.tier === 0 ? 12 : partial.tier === 1 ? 24 : partial.tier === 2 ? 48 : 120,
    agendaBaseUrl: "https://example.gov",
    agendaPathHints: ["/agendas"],
    isActive: true,
    notes: null,
    ...partial,
  };
}

describe("jurisdiction-scheduler", () => {
  it("assigns never-scanned jurisdictions priority 999", () => {
    const j = hydrateJurisdiction(seed({ jurisdictionId: "county#GA#x", tier: 3 }));
    expect(computePriorityScore(j)).toBe(NEVER_SCANNED_PRIORITY);
  });

  it("selects top 30 by priority and prefers never-scanned", () => {
    const now = Date.parse("2026-08-01T12:00:00.000Z");
    const all = Array.from({ length: 40 }, (_, i) =>
      hydrateJurisdiction(
        seed({
          jurisdictionId: `county#GA#j${i}`,
          tier: 3,
          stateCode: "GA",
        }),
        {
          lastScannedAt: i < 5 ? "" : new Date(now - 200 * 3600_000).toISOString(),
        },
      ),
    );
    const batch = selectJurisdictionsForRun(all, 30, now);
    expect(batch.length).toBeLessThanOrEqual(30);
    expect(batch.slice(0, 5).every((j) => !j.lastScannedAt)).toBe(true);
  });

  it("boosts tier-3 jurisdictions when state coverage is stale", async () => {
    const now = Date.parse("2026-08-01T12:00:00.000Z");
    const jurisdictions = [
      hydrateJurisdiction(seed({ jurisdictionId: "county#WV#a", tier: 3, stateCode: "WV" }), {
        lastScannedAt: new Date(now - 10 * 3600_000).toISOString(),
      }),
      hydrateJurisdiction(seed({ jurisdictionId: "county#WV#b", tier: 1, stateCode: "WV" }), {
        lastScannedAt: new Date(now - 10 * 3600_000).toISOString(),
      }),
    ];
    const boosted = await applyStateCoverageBoosts(
      jurisdictions,
      {
        getAllStateCoverage: async () => [
          {
            stateCode: "WV",
            stateName: "West Virginia",
            lastScannedAt: new Date(now - 100 * 3600_000).toISOString(),
            lastSignalAt: null,
            totalSignals: 0,
            jurisdictionCount: 2,
          },
        ],
      },
      now,
    );
    expect(boosted.find((j) => j.jurisdictionId === "county#WV#a")?.priorityBoost).toBe(
      STATE_COVERAGE_BOOST,
    );
    expect(boosted.find((j) => j.jurisdictionId === "county#WV#b")?.priorityBoost).toBe(0);
  });

  it("boosts venue jurisdictions in March–May and September–November", () => {
    const venue = hydrateJurisdiction(
      seed({
        jurisdictionId: "venue_event#GA#peachtree",
        type: "venue_event",
        tier: 1,
      }),
    );
    const county = hydrateJurisdiction(seed({ jurisdictionId: "county#GA#x", tier: 1 }));
    const peak = applyVenueSeasonalBoost([venue, county], new Date("2026-04-15T12:00:00.000Z"));
    expect(peak.find((j) => j.type === "venue_event")?.priorityBoost).toBe(3);
    expect(peak.find((j) => j.type === "county")?.priorityBoost).toBe(0);

    const off = applyVenueSeasonalBoost([venue], new Date("2026-07-04T12:00:00.000Z"));
    expect(off[0]?.priorityBoost).toBe(0);
  });
});

describe("orchestrator window", () => {
  it("is within window for midday ET", () => {
    // 2026-08-01 16:00 UTC = 12:00 ET (EDT)
    expect(isWithinCollectionWindow(new Date("2026-08-01T16:00:00.000Z"))).toBe(true);
  });

  it("is outside window after 7pm ET", () => {
    // 2026-08-02 00:00 UTC = 20:00 ET previous day (EDT)
    expect(isWithinCollectionWindow(new Date("2026-08-02T00:00:00.000Z"))).toBe(false);
  });
});

describe("agenda-collector", () => {
  it("requires a batch array", async () => {
    await expect(runAgendaCollector(undefined as unknown as [])).rejects.toThrow(/batch/i);
  });
});
