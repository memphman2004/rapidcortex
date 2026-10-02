import { describe, expect, it } from "vitest";
import { applySignalIntelligence } from "../apply-signal-intelligence.js";
import { agencyIdFromName, normalizeAgencyName } from "../resolve-agency.js";

describe("applySignalIntelligence", () => {
  it("stores combined score as fitScore and keeps two independent scores", () => {
    const intel = applySignalIntelligence({
      hay: "Request for proposal for NG911 CAD at the county PSAP with capital budget approved",
      sourceId: "sam-gov",
      sourceUrl: "https://sam.gov/opp/example",
      signalDate: new Date().toISOString().slice(0, 10),
      agencyType: "psap",
      procurementStage: "rfp",
    });
    expect(intel.buyingIntentScore).toBeGreaterThan(0);
    expect(intel.productFitScore).toBeGreaterThan(0);
    expect(intel.combinedScore).toBeGreaterThan(0);
    expect(intel.fitScore).toBeGreaterThanOrEqual(intel.combinedScore);
    expect(intel.excerpt?.length).toBeGreaterThan(0);
    expect(intel.excerpt?.length).toBeLessThanOrEqual(500);
    expect(intel.sourceDomain).toBe("sam.gov");
    expect(intel.taxonomyTags?.length).toBeGreaterThan(0);
    expect(intel.intentEvidence?.length).toBeGreaterThan(0);
  });
});

describe("resolveAgency name keys", () => {
  it("normalizes county office variants toward the same tokens", () => {
    expect(normalizeAgencyName("The Livingston County Sheriff's Office")).toContain("livingston");
    expect(agencyIdFromName("Franklin County 911", "OH")).toContain("franklin");
    expect(agencyIdFromName("Franklin County 911", "OH")).toContain("OH");
  });
});
