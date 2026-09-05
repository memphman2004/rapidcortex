import { describe, expect, it } from "vitest";
import {
  CAMPUS_WATCH_SEEDS,
  PSAP_WATCH_SEEDS,
  VENUE_WATCH_SEEDS,
  VERTICAL_INTEL_WATCH_SEEDS,
  VERTICAL_WATCH_SEED_SUMMARY,
  allIntelWatchRecords,
} from "./intel-watch-seeds.js";
import { RAPID_IQ_TRANSIT_WATCH_SEEDS } from "./transit-watches.js";

describe("intel watch seeds", () => {
  it("keeps 25 transit agencies and 17/13/13 PSAP/campus/venue watches", () => {
    expect(RAPID_IQ_TRANSIT_WATCH_SEEDS).toHaveLength(25);
    expect(PSAP_WATCH_SEEDS).toHaveLength(17);
    expect(CAMPUS_WATCH_SEEDS).toHaveLength(13);
    expect(VENUE_WATCH_SEEDS).toHaveLength(13);
    expect(VERTICAL_INTEL_WATCH_SEEDS).toHaveLength(43);
    expect(VERTICAL_WATCH_SEED_SUMMARY).toEqual({
      psap: 17,
      campus: 13,
      venue: 13,
      transit: 25,
      verticalNew: 43,
    });
  });

  it("uses unique watch ids across transit and vertical seeds", () => {
    const records = allIntelWatchRecords("2026-09-04T00:00:00.000Z");
    const ids = records.map((w) => w.id);
    expect(ids).toHaveLength(68);
    expect(new Set(ids).size).toBe(68);
  });

  it("enables web search on vertical watches and keeps transit off", () => {
    const records = allIntelWatchRecords("2026-09-04T00:00:00.000Z");
    const transit = records.filter((w) => w.market === "TRANSIT");
    const vertical = records.filter((w) => w.market !== "TRANSIT");
    expect(transit.every((w) => w.webSearchEnabled === false)).toBe(true);
    expect(vertical.every((w) => w.webSearchEnabled === true)).toBe(true);
    expect(vertical.every((w) => w.sourceUrls.length > 0)).toBe(true);
  });
});
