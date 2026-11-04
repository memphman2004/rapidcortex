import { describe, expect, it } from "vitest";
import {
  buildGrantWriterPrompt,
  normalizeGrantWriterSections,
  salvageGrantWriterSections,
} from "./grant-writer-narrative.js";

describe("grant writer narrative helpers", () => {
  it("asks the model for detailed multi-paragraph sections", () => {
    const prompt = buildGrantWriterPrompt({
      agencyName: "Cortex County Emergency Communications",
      projectDescription: "Deploy NexCort iQ beside CAD.",
      rcModules: ["AI Dispatch Transcription", "Multi-Language Translation"],
      requestedAmount: "$248,000",
    });
    expect(prompt).toContain("LENGTH AND DEPTH REQUIREMENTS");
    expect(prompt).toContain("AI Dispatch Transcription");
    expect(prompt).toContain("Multi-Language Translation");
    expect(prompt).toContain("6–8 SMART-style objectives");
    expect(prompt).toContain("Cortex County Emergency Communications");
  });

  it("normalizes mixed array and string payloads", () => {
    const sections = normalizeGrantWriterSections({
      executiveSummary: "Summary",
      goalsAndObjectives: ["Goal 1", 12, "", "Goal 2"],
      implementationTimeline: null,
    });
    expect(sections.executiveSummary).toBe("Summary");
    expect(sections.goalsAndObjectives).toEqual(["Goal 1", "Goal 2"]);
    expect(sections.implementationTimeline).toEqual([]);
  });

  it("salvages truncated JSON with partial section payloads", () => {
    const truncated = `{
  "executiveSummary": "Para one.\\n\\nPara two.",
  "statementOfNeed": "Need paragraph.",
  "projectDescription": "Project paragraph.",
  "goalsAndObjectives": ["Goal 1", "Goal 2",
  "implementationTimeline": ["Month 1: kickoff"`;
    const salvaged = salvageGrantWriterSections(truncated);
    expect(salvaged).not.toBeNull();
    expect(salvaged?.executiveSummary).toContain("Para one");
    expect(salvaged?.statementOfNeed).toContain("Need paragraph");
    expect(salvaged?.goalsAndObjectives).toContain("Goal 1");
  });
});
