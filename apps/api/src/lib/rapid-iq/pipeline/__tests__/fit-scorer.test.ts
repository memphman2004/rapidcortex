import { describe, expect, it } from "vitest";
import { computeFitScore } from "../fit-scorer.js";
import { contentHash } from "../rapid-iq-pipeline-db.js";
import { extractSignalDataHeuristic, jeffersonCountyMockRawSignal } from "../nlp-extract.js";

describe("contentHash", () => {
  it("is stable for identical title+snippet", () => {
    const a = contentHash("Title A", "snippet body one");
    const b = contentHash("Title A", "snippet body one");
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
  });

  it("changes when title or snippet prefix changes", () => {
    const base = contentHash("Title A", "snippet body one");
    expect(contentHash("Title B", "snippet body one")).not.toBe(base);
    expect(contentHash("Title A", "different snippet")).not.toBe(base);
  });
});

describe("computeFitScore", () => {
  it("scores Jefferson County Tyler ARPA $200K new-cad ≥ 65", () => {
    const raw = jeffersonCountyMockRawSignal("legistar-bulk");
    const extraction = extractSignalDataHeuristic(raw);
    // Ensure win-condition fields are present for the known sample
    expect(extraction.vendorNamed?.toLowerCase()).toContain("tyler");
    expect(extraction.fundingSource?.toLowerCase()).toContain("arpa");
    expect(extraction.procurementType).toBe("new-cad");
    expect(extraction.dollarAmount).toBe(200_000);

    const { score, label } = computeFitScore({
      ...extraction,
      agencyType: extraction.agencyType ?? "911",
      procurementType: "new-cad",
      vendorNamed: "Tyler Technologies",
      fundingSource: "ARPA",
      dollarAmount: 200_000,
    });

    // +30 new-cad +20 Tyler +15 ARPA +15 911 +10 pilot range = 90
    expect(score).toBeGreaterThanOrEqual(65);
    expect(score).toBeGreaterThanOrEqual(80);
    expect(label).toBe("high");
  });

  it("penalizes hardware-only with no PS relevance", () => {
    const { score } = computeFitScore({
      procurementType: "hardware",
      agencyType: undefined,
      vendorNamed: undefined,
    });
    expect(score).toBeLessThan(40);
  });
});
