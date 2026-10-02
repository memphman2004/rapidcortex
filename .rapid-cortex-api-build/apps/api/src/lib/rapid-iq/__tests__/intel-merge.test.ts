import { describe, expect, it } from "vitest";
import { recommendPursuit } from "../intel-recommend.js";
import { extractEstimatedValue, extractSolicitationNumber, mergeIntelExtraction } from "../intel-merge.js";
import type { RapidIqIntelAiExtraction, RapidIqIntelSourceDocument } from "rapid-cortex-shared";

describe("recommendPursuit", () => {
  it("ignores low fit", () => {
    expect(recommendPursuit({ fitScore: 4, procurementStage: 8, preRfpSignal: false })).toBe("IGNORE");
  });

  it("pursues high fit active solicitations", () => {
    expect(recommendPursuit({ fitScore: 8, procurementStage: 8, preRfpSignal: false })).toBe("PURSUE");
  });

  it("watches pre-RFP high fit", () => {
    expect(recommendPursuit({ fitScore: 8, procurementStage: 3, preRfpSignal: true })).toBe("WATCH");
  });

  it("partners on large late-stage opportunities", () => {
    expect(
      recommendPursuit({
        fitScore: 8,
        procurementStage: 8,
        preRfpSignal: false,
        estimatedValue: 5_000_000,
      }),
    ).toBe("PARTNER");
  });
});

describe("source fact extraction", () => {
  it("extracts solicitation numbers", () => {
    expect(extractSolicitationNumber("See RFP # CTA-2026-19 for CAD")).toBe("CTA-2026-19");
  });

  it("extracts dollar amounts", () => {
    expect(extractEstimatedValue("budget of $2.5 million")).toBe(2_500_000);
  });
});

describe("mergeIntelExtraction", () => {
  const extraction: RapidIqIntelAiExtraction = {
    agency: "AI Agency",
    title: "AI Title",
    opportunityType: "RFP",
    categories: ["CAD"],
    rapidCortexProducts: ["TRANSIT"],
    fitScore: 8,
    winSignal: 6,
    confidence: 0.7,
    recommendation: "PURSUE",
    procurementStage: 8,
    preRfpSignal: false,
    reason: "fit",
    recommendedAction: "call",
    solicitationNumber: "AI-1",
  };

  const doc: RapidIqIntelSourceDocument = {
    sourceId: "s1",
    url: "https://www.Example.com/rfp/",
    title: "Board agenda public safety",
    text: "RFP # SRC-99 CAD overlay $1 million",
    retrievedAt: "2026-09-02T00:00:00.000Z",
    sourceType: "web_page",
    sourceName: "CTA",
  };

  it("lets source facts override AI fields and preserves pursuit status", () => {
    const merged = mergeIntelExtraction({
      existing: {
        id: "intel_1",
        agency: "CTA",
        market: "TRANSIT",
        title: "Old title",
        opportunityType: "BOARD_AGENDA",
        sourceUrl: "https://example.com/rfp",
        categories: [],
        rapidCortexProducts: ["TRANSIT"],
        fitScore: 7,
        winSignal: 5,
        confidence: 0.4,
        recommendation: "WATCH",
        procurementStage: 3,
        preRfpSignal: true,
        reason: "old",
        recommendedAction: "wait",
        discoveredAt: "2026-08-01T00:00:00.000Z",
        lastUpdatedAt: "2026-08-01T00:00:00.000Z",
        status: "PURSUING",
        userRecommendation: "WATCH",
      },
      extraction,
      doc,
      market: "TRANSIT",
      id: "intel_1",
      fingerprint: "abc",
      modelUsed: "gpt-4o-mini",
    });
    expect(merged.status).toBe("PURSUING");
    expect(merged.userRecommendation).toBe("WATCH");
    expect(merged.solicitationNumber).toBe("SRC-99");
    expect(merged.estimatedValue).toBe(1_000_000);
    expect(merged.aiRecommendation).toBe("PURSUE");
    expect(merged.discoveredAt).toBe("2026-08-01T00:00:00.000Z");
  });
});
