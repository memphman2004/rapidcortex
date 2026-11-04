import { describe, expect, it } from "vitest";
import { buildProfileGrantNarrative, fillEmptyGrantNarrative } from "./profile-narrative.js";

const sampleForm = {
  agencyName: "Cortex County Emergency Communications",
  agencyType: "911 / Emergency Communications Center (ECC)",
  agencyCity: "Kansas City",
  agencyState: "MO",
  agencyPopulation: "210,000",
  contactName: "Alex Morgan",
  contactTitle: "Communications Center Manager",
  contactEmail: "amorgan@cortexcounty.example",
  grantName: "COPS Technology Program",
  fundingAgency: "U.S. Department of Justice, Office of Community Oriented Policing Services",
  grantNumber: "O-COPS-2026-DEMO",
  requestedAmount: "$248,000",
  projectPeriod: "24 months",
  deadline: "March 15, 2027",
  projectTitle: "NexCort iQ communications intelligence for Cortex County",
  projectDescription: "Deploy NexCort iQ beside the existing CAD system.",
  problemStatement: "Supervisors reconstruct calls from partial notes.",
  staffingChallenge: "Vacancies on the call-taking floor",
  existingTechnology: "Existing CAD and a hosted phone system",
  rcModules: ["AI Dispatch Transcription", "QA & Coaching Automation", "Multi-Language Translation"],
  additionalContext: "Demonstration profile for package review.",
};

describe("grant profile narrative", () => {
  it("uses the agency, grant, and amount the user entered", () => {
    const sections = buildProfileGrantNarrative(sampleForm);
    expect(sections.executiveSummary).toContain("Cortex County Emergency Communications");
    expect(sections.executiveSummary).toContain("COPS Technology Program");
    expect(sections.budgetNarrative).toContain("$248,000");
    expect(sections.projectDescription).toContain("beside the existing CAD system");
    expect(sections.goalsAndObjectives.length).toBeGreaterThanOrEqual(5);
    expect(sections.implementationTimeline.length).toBeGreaterThanOrEqual(5);
  });

  it("expands selected modules and additional context into the narrative", () => {
    const sections = buildProfileGrantNarrative(sampleForm);
    expect(sections.projectDescription).toContain("AI Dispatch Transcription");
    expect(sections.projectDescription).toContain("QA & Coaching Automation");
    expect(sections.statementOfNeed).toContain("Demonstration profile for package review");
    expect(sections.organizationalCapacity).toContain("amorgan@cortexcounty.example");
    expect(sections.evaluationPlan.length).toBeGreaterThan(400);
    expect(sections.executiveSummary.length).toBeGreaterThan(450);
  });

  it("keeps rich model text and replaces only empty or thin sections", () => {
    const richSummary =
      "A".repeat(500) +
      " Model-written executive summary with enough substance for funder review.";
    const filled = fillEmptyGrantNarrative(
      {
        executiveSummary: richSummary,
        statementOfNeed: "Too short.",
        projectDescription: "",
        goalsAndObjectives: ["Only one goal"],
        implementationTimeline: ["Month 1: start"],
        evaluationPlan: "",
        organizationalCapacity: "",
        budgetNarrative: "",
        sustainabilityPlan: "",
        conclusion: "",
      },
      sampleForm,
    );
    expect(filled.executiveSummary).toBe(richSummary);
    expect(filled.implementationTimeline.length).toBeGreaterThan(1);
    expect(filled.goalsAndObjectives.length).toBeGreaterThan(1);
    expect(filled.statementOfNeed).toContain("Cortex County Emergency Communications");
    expect(filled.projectDescription).toContain("beside the existing CAD system");
  });
});
