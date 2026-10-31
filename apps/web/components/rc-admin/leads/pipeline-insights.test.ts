import { describe, expect, it } from "vitest";
import type { SalesLeadCrmRecord } from "rapid-cortex-shared";
import {
  buildPipelineInsight,
  dealProbability,
  pipelineFitScore,
  suggestedNextStep,
  weightedDealValue,
} from "./pipeline-insights";

function lead(partial: Partial<SalesLeadCrmRecord> & Pick<SalesLeadCrmRecord, "leadId" | "pipelineStage">): SalesLeadCrmRecord {
  return {
    email: `${partial.leadId}@example.com`,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("pipeline insights", () => {
  it("uses the stage chance when a lead has no probability", () => {
    const row = lead({ leadId: "a", pipelineStage: "PROPOSAL", estimatedValue: 10000 });
    expect(dealProbability(row)).toBe(50);
    expect(weightedDealValue(row)).toBe(5000);
  });

  it("keeps a rep-entered probability", () => {
    const row = lead({ leadId: "b", pipelineStage: "PROPOSAL", estimatedValue: 10000, probability: 80 });
    expect(dealProbability(row)).toBe(80);
    expect(weightedDealValue(row)).toBe(8000);
  });

  it("drops lost deals from the weighted forecast and groups the reason", () => {
    const insight = buildPipelineInsight([
      lead({ leadId: "open", pipelineStage: "NEGOTIATION", estimatedValue: 20000, assignedToName: "Ada" }),
      lead({ leadId: "lost", pipelineStage: "LOST", estimatedValue: 9000, lostReason: "Budget" }),
    ]);
    expect(insight.openCount).toBe(1);
    expect(insight.weightedOpenValue).toBe(14000);
    expect(insight.lossReasons).toEqual([{ reason: "Budget", count: 1 }]);
    expect(insight.reps[0]?.name).toBe("Ada");
  });

  it("asks for an owner before other next steps", () => {
    const row = lead({
      leadId: "c",
      pipelineStage: "DISCOVERY",
      estimatedValue: 5000,
      lastContactedAt: new Date().toISOString(),
    });
    expect(suggestedNextStep(row)).toBe("Assign an owner before the next touch.");
  });

  it("keeps the fit score inside 1–100", () => {
    const row = lead({
      leadId: "d",
      pipelineStage: "PILOT",
      estimatedValue: 40000,
      assignedToName: "Ada",
      vertical: "rc911",
      nextAction: "Send the pilot plan",
      lastContactedAt: new Date().toISOString(),
      source: "contact_sales",
      pilotStartDate: "2026-11-01",
    });
    const score = pipelineFitScore(row);
    expect(score).toBeGreaterThanOrEqual(1);
    expect(score).toBeLessThanOrEqual(100);
  });
});
