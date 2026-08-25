import { describe, expect, it } from "vitest";
import {
  classifyProcurementStage,
  classifyTaxonomy,
  extractExcerpt,
  isRelevantSignalText,
  keywordMatches,
  matchesProcurementStageFilter,
  scoreFit,
  scoreSignal,
} from "./signal-keywords.js";

describe("keywordMatches", () => {
  it("does not treat cascade as CAD", () => {
    expect(keywordMatches("Cascade County facilities maintenance cascade", "CAD")).toBe(false);
    expect(keywordMatches("Replace the CAD system at the PSAP", "CAD")).toBe(true);
  });
});

describe("isRelevantSignalText", () => {
  it("treats standalone dispatch and Axon as relevant", () => {
    expect(isRelevantSignalText("County dispatch modernization plan")).toBe(true);
    expect(isRelevantSignalText("Axon body-worn camera award")).toBe(true);
  });
});

describe("classifyProcurementStage", () => {
  it("ranks RFP above funding and planning", () => {
    expect(classifyProcurementStage("County issues RFP for NG911")).toBe("rfp");
    expect(classifyProcurementStage("Staff recommends a modernization plan for the PSAP")).toBe(
      "rfi-planning",
    );
    expect(classifyProcurementStage("ARPA budget approved for 911")).toBe("budget-funded");
    expect(classifyProcurementStage("Legacy CAD system approaching end of life")).toBe(
      "early-awareness",
    );
    expect(classifyProcurementStage("Weekly operations briefing")).toBe("monitoring");
  });
});

describe("scoreFit", () => {
  it("scores 911.gov NG911 grant language highly", () => {
    const score = scoreFit(
      "Federal NG911 grant for public safety answering point CAD modernization",
      "911-gov",
    );
    expect(score).toBeGreaterThanOrEqual(50);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("gives SAM.gov RFPs a source bonus", () => {
    const sam = scoreFit("Request for proposal computer aided dispatch PSAP", "sam-gov");
    const news = scoreFit("Request for proposal computer aided dispatch PSAP", "news");
    expect(sam).toBeGreaterThan(news);
  });
});

describe("matchesProcurementStageFilter", () => {
  it("maps UI tabs onto stored stages", () => {
    expect(matchesProcurementStageFilter("rfp", "rfp")).toBe(true);
    expect(matchesProcurementStageFilter("budget-funded", "funded")).toBe(true);
    expect(matchesProcurementStageFilter("funding-available", "funded")).toBe(true);
    expect(matchesProcurementStageFilter("competitor-win", "competitor")).toBe(true);
    expect(matchesProcurementStageFilter("rfp", "early")).toBe(false);
    expect(matchesProcurementStageFilter("rfp", "all")).toBe(true);
  });
});

describe("scoreSignal", () => {
  it("splits buying intent from product fit and weights combined 60/40", () => {
    const scores = scoreSignal(
      "County issues a request for proposal for NG911 CAD modernization at the PSAP with a $1.2M capital budget",
      "sam-gov",
      { sourceUrl: "https://sam.gov/opp/1", signalDate: new Date().toISOString().slice(0, 10) },
    );
    expect(scores.buyingIntentScore).toBeGreaterThanOrEqual(40);
    expect(scores.productFitScore).toBeGreaterThanOrEqual(40);
    expect(scores.combinedScore).toBe(
      Math.round(scores.buyingIntentScore * 0.6 + scores.productFitScore * 0.4),
    );
    expect(scores.intentEvidence.length).toBeGreaterThan(0);
    expect(scores.fitEvidence.length).toBeGreaterThan(0);
    expect(scores.buyingIntentScore).toBeLessThanOrEqual(100);
    expect(scores.productFitScore).toBeLessThanOrEqual(100);
  });

  it("does not treat cascade as CAD in product fit", () => {
    const scores = scoreSignal("Cascade County facilities maintenance cascade", "news");
    expect(scores.fitEvidence.some((e) => e.factor.toLowerCase().includes("cad"))).toBe(false);
  });
});

describe("extractExcerpt + classifyTaxonomy", () => {
  it("captures surrounding context around a match", () => {
    const text = `${"x".repeat(200)}NG911 grant awarded${"y".repeat(200)}`;
    const excerpt = extractExcerpt(text, 200);
    expect(excerpt.startsWith("...")).toBe(true);
    expect(excerpt).toContain("NG911");
    expect(excerpt.length).toBeLessThanOrEqual(500);
  });

  it("tags public-safety taxonomy terms", () => {
    const tags = classifyTaxonomy(
      "County RFP for next generation 911 call handling and campus safety",
    );
    expect(tags.some((t) => t.includes("ng911") || t.includes("next-generation-911"))).toBe(true);
    expect(tags).toContain("procurement:rfp");
    expect(tags).toContain("technology:campus-safety");
  });
});
