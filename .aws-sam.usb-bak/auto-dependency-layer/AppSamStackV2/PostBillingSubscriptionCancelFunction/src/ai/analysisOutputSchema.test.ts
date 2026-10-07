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
});
