import { describe, expect, it } from "vitest";
import { parseAndValidateAnalysisOutput } from "./analysisOutputSchema.js";

describe("parseAndValidateAnalysisOutput", () => {
  it("repairs JSON wrapped in prose with outer braces", () => {
    const raw =
      'Here is the JSON:\n{"category":"unknown","urgency":"low","confidence":0.2,"nextQuestion":"What is the address?","recommendedAction":"Clarify.","summary":"Unclear.","rationale":"Thin transcript.","escalationFlag":false}\nThanks.';
    const out = parseAndValidateAnalysisOutput(raw);
    expect(out.category).toBe("unknown");
    expect(out.escalationFlag).toBe(false);
  });

  it("normalizes 0–100 confidence to 0–1", () => {
    const out = parseAndValidateAnalysisOutput({
      category: "police",
      urgency: "high",
      confidence: 85,
      nextQuestion: "Is anyone hurt?",
      recommendedAction: "Dispatch units.",
      summary: "Possible assault in progress.",
      rationale: "Caller reported fighting.",
      escalationFlag: true,
    });
    expect(out.confidence).toBe(0.85);
  });
});
