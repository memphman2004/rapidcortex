import { describe, expect, it } from "vitest";
import { buildProfileGrantNarrative, fillEmptyGrantNarrative } from "./profile-narrative.js";

describe("grant profile narrative", () => {
  it("uses the agency, grant, and amount the user entered", () => {
    const sections = buildProfileGrantNarrative({
      agencyName: "Cortex County Emergency Communications",
      grantName: "COPS Technology Program",
      requestedAmount: "$248,000",
      projectDescription: "Deploy NexCort iQ beside the existing CAD system.",
    });
    expect(sections.executiveSummary).toContain("Cortex County Emergency Communications");
    expect(sections.executiveSummary).toContain("COPS Technology Program");
    expect(sections.budgetNarrative).toContain("$248,000");
    expect(sections.projectDescription).toContain("beside the existing CAD system");
    expect(sections.goalsAndObjectives.length).toBeGreaterThan(2);
  });

  it("keeps model text and fills only the empty sections", () => {
    const filled = fillEmptyGrantNarrative(
      {
        executiveSummary: "Model summary.",
        statementOfNeed: "",
        projectDescription: "",
        goalsAndObjectives: [],
        implementationTimeline: ["Month 1: start"],
        evaluationPlan: "",
        organizationalCapacity: "",
        budgetNarrative: "",
        sustainabilityPlan: "",
        conclusion: "",
      },
      { agencyName: "Cortex County Emergency Communications" },
    );
    expect(filled.executiveSummary).toBe("Model summary.");
    expect(filled.implementationTimeline).toEqual(["Month 1: start"]);
    expect(filled.statementOfNeed).toContain("Cortex County Emergency Communications");
  });
});
