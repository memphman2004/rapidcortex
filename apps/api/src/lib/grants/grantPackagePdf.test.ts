import { describe, expect, it } from "vitest";
import { generateGrantPackagePdfBuffer } from "./grantPackagePdf.js";
import type { GrantPackage } from "rapid-cortex-shared";

const sample: GrantPackage = {
  executiveSummary: "Executive summary for Test U.",
  problemStatement: "Problem statement.",
  projectNarrative: "Project narrative.",
  technologyDescription: "Technology description.",
  budget: [
    {
      item: "Rapid Cortex Campus platform",
      quantity: 1,
      unitCost: 90000,
      totalCost: 90000,
      category: "Platform",
    },
  ],
  totalBudget: 90000,
  budgetJustification: "Budget justification.",
  timeline: [{ phase: "Deploy", period: "Mth 1–6", milestones: ["Kickoff", "Go-live"] }],
  cybersecurity: "Cybersecurity section.",
  sustainability: "Sustainability plan.",
  evaluation: "Evaluation plan.",
  outcomes: [
    {
      metric: "Reporting latency",
      baseline: "Unknown",
      target: "<60s",
      timeframe: "By month 6",
    },
  ],
};

describe("generateGrantPackagePdfBuffer", () => {
  it("returns a non-empty PDF buffer", async () => {
    const buf = await generateGrantPackagePdfBuffer({
      profile: {
        schoolName: "Test University",
        city: "Athens",
        state: "GA",
        grantPrograms: ["cops_svpp"],
        grantAmount: "90000",
        projectPeriod: "12",
      },
      package: sample,
    });
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });
});
