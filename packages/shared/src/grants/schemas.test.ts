import { describe, expect, it } from "vitest";
import {
  grantPackageSchema,
  normalizeGrantPackageCandidate,
} from "./schemas.js";

describe("normalizeGrantPackageCandidate + grantPackageSchema", () => {
  it("coerces string numbers and milestone strings", () => {
    const raw = {
      executiveSummary: "Exec",
      problemStatement: "Problem",
      projectNarrative: "Narrative",
      technologyDescription: "Tech",
      budget: [
        {
          item: "Platform",
          quantity: "1",
          unitCost: "50000",
          totalCost: "50000",
          category: "Platform",
        },
      ],
      totalBudget: "50000",
      budgetJustification: "Justify",
      timeline: [
        {
          phase: "Deploy",
          period: "Mth 1–3",
          milestones: "Kickoff; Go-live",
        },
      ],
      cybersecurity: "Cyber",
      sustainability: "Sustain",
      evaluation: "Eval",
      outcomes: [
        {
          metric: "Response time",
          baseline: 0,
          target: "60s",
          timeframe: "Month 6",
        },
      ],
    };

    const normalized = normalizeGrantPackageCandidate(raw);
    const parsed = grantPackageSchema.safeParse(normalized);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.totalBudget).toBe(50000);
    expect(parsed.data.budget[0]?.quantity).toBe(1);
    expect(parsed.data.timeline[0]?.milestones).toEqual(["Kickoff", "Go-live"]);
    expect(parsed.data.outcomes[0]?.baseline).toBe("0");
  });

  it("rejects empty budget after normalize", () => {
    const raw = {
      executiveSummary: "Exec",
      problemStatement: "Problem",
      projectNarrative: "Narrative",
      technologyDescription: "Tech",
      budget: [],
      totalBudget: 0,
      budgetJustification: "Justify",
      timeline: [{ phase: "A", period: "1", milestones: ["x"] }],
      cybersecurity: "Cyber",
      sustainability: "Sustain",
      evaluation: "Eval",
      outcomes: [{ metric: "m", baseline: "b", target: "t", timeframe: "f" }],
    };
    expect(grantPackageSchema.safeParse(normalizeGrantPackageCandidate(raw)).success).toBe(false);
  });
});
