import { describe, expect, it } from "vitest";
import {
  computeHotScore,
  filterSignalsForVertical,
  grantVisibleToVertical,
  verticalsFromGrantCategories,
  type LeadSignal,
} from "./grant-signal-types.js";

describe("vertical isolation for grants/signals", () => {
  it("maps grant categories to verticals without cross-bleed", () => {
    expect(verticalsFromGrantCategories(["campus_safety"])).toEqual(["campus"]);
    expect(verticalsFromGrantCategories(["venue_security", "911_technology"]).sort()).toEqual([
      "rc911",
      "venue",
    ]);
  });

  it("hides campus grants from venue leads and vice versa", () => {
    expect(grantVisibleToVertical(["campus"], "venue")).toBe(false);
    expect(grantVisibleToVertical(["venue"], "campus")).toBe(false);
    expect(grantVisibleToVertical(["campus"], "campus")).toBe(true);
    expect(grantVisibleToVertical(["rc911"], "unknown")).toBe(true);
    expect(grantVisibleToVertical(["campus"], "unknown")).toBe(false);
  });

  it("filters signals strictly by vertical", () => {
    const signals: LeadSignal[] = [
      {
        signalId: "1",
        leadId: "l1",
        type: "GRANT_SIGNAL",
        title: "Campus grant",
        summary: "x",
        source: "grants.gov",
        strength: "strong",
        detectedAt: new Date().toISOString(),
        repAcknowledged: false,
        vertical: "campus",
      },
      {
        signalId: "2",
        leadId: "l1",
        type: "RFP_SIGNAL",
        title: "Venue RFP",
        summary: "y",
        source: "sam.gov",
        strength: "strong",
        detectedAt: new Date().toISOString(),
        repAcknowledged: false,
        vertical: "venue",
      },
    ];
    expect(filterSignalsForVertical(signals, "campus").map((s) => s.signalId)).toEqual(["1"]);
    expect(filterSignalsForVertical(signals, "venue").map((s) => s.signalId)).toEqual(["2"]);
  });

  it("computes hot score from recent signals", () => {
    const now = Date.now();
    const signals: LeadSignal[] = [
      {
        signalId: "1",
        leadId: "l1",
        type: "RFP_SIGNAL",
        title: "rfp",
        summary: "s",
        source: "sam.gov",
        strength: "strong",
        detectedAt: new Date(now).toISOString(),
        repAcknowledged: false,
        vertical: "rc911",
      },
    ];
    expect(computeHotScore(signals, now)).toBe(30);
  });
});
