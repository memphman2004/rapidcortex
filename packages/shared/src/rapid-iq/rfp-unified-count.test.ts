import { describe, expect, it } from "vitest";
import {
  accumulateRfpCount,
  emptyRfpVerticalCounts,
  isUnifiedRfpRecord,
  sumRfpVerticalCounts,
} from "./rfp-unified-count.js";

describe("isUnifiedRfpRecord", () => {
  it("counts feed RFP LIVE tags and pipeline active_rfp", () => {
    expect(isUnifiedRfpRecord({ tags: ["RFP LIVE", "NG911"] })).toBe(true);
    expect(isUnifiedRfpRecord({ intentStage: "active_rfp" })).toBe(true);
    expect(isUnifiedRfpRecord({ signalType: "rfp" })).toBe(true);
    expect(isUnifiedRfpRecord({ procurementStage: "rfp" })).toBe(true);
  });

  it("counts intel solicitations and late-stage / pre-RFP signals, not generic agendas", () => {
    expect(isUnifiedRfpRecord({ opportunityType: "RFP", relevant: true, fitScore: 8 })).toBe(true);
    expect(isUnifiedRfpRecord({ procurementStage: 8 })).toBe(true);
    expect(
      isUnifiedRfpRecord({ opportunityType: "PRE_RFP_SIGNAL", preRfpSignal: true }),
    ).toBe(true);
    expect(
      isUnifiedRfpRecord({
        pk: "INTEL#abc",
        relevant: true,
        fitScore: 9,
        opportunityType: "BOARD_AGENDA",
        procurementStage: 3,
      }),
    ).toBe(false);
  });
});

describe("accumulateRfpCount", () => {
  it("excludes dismissed rows from the open tile count", () => {
    const counts = emptyRfpVerticalCounts();
    accumulateRfpCount(counts, { market: "PSAP", status: "new" });
    accumulateRfpCount(counts, { market: "CAMPUS", status: "dismissed" });
    expect(counts.all).toBe(2);
    expect(counts.open).toBe(1);
    expect(counts.psap).toBe(1);
    expect(counts.campus).toBe(1);
    expect(counts.byStatus.dismissed).toBe(1);
  });

  it("sums three stores without double-counting dismissed", () => {
    const feed = emptyRfpVerticalCounts();
    const pipeline = emptyRfpVerticalCounts();
    const intel = emptyRfpVerticalCounts();
    accumulateRfpCount(feed, { market: "PSAP", status: "new" });
    accumulateRfpCount(pipeline, { market: "TRANSIT", status: "dismissed" });
    accumulateRfpCount(intel, { market: "VENUE", status: "pursuing" });
    const total = sumRfpVerticalCounts(feed, pipeline, intel);
    expect(total.all).toBe(3);
    expect(total.open).toBe(2);
    expect(total.psap).toBe(1);
    expect(total.transit).toBe(1);
    expect(total.venue).toBe(1);
  });
});
