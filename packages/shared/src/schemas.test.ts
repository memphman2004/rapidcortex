import { describe, expect, it } from "vitest";
import { ContractValidationError, parseAiAnalysisRecord } from "./schemas.js";

describe("parseAiAnalysisRecord", () => {
  it("accepts a minimal valid analysis document", () => {
    const row = parseAiAnalysisRecord({
      analysisId: "a1",
      incidentId: "i1",
      agencyId: "agency-x",
      category: "medical",
      urgency: "high",
      confidence: 0.8,
      nextQuestion: "Is the patient breathing?",
      recommendedAction: "Dispatch EMS.",
      summary: "Chest pain.",
      rationale: "Caller reports chest pain.",
      escalationFlag: false,
      provider: "mock",
      createdAt: new Date().toISOString(),
    });
    expect(row.analysisId).toBe("a1");
  });

  it("rejects invalid category", () => {
    expect(() =>
      parseAiAnalysisRecord({
        analysisId: "a1",
        incidentId: "i1",
        agencyId: "agency-x",
        category: "not-a-category",
        urgency: "high",
        confidence: 0.8,
        nextQuestion: "Q",
        recommendedAction: "A",
        summary: "S",
        rationale: "R",
        escalationFlag: false,
        provider: "mock",
        createdAt: new Date().toISOString(),
      }),
    ).toThrow(ContractValidationError);
  });
});
