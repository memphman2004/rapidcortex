import { describe, expect, it } from "vitest";
import { DISAMBIGUATION_RULES } from "./disambiguation.js";

function run(intent: string, transcript: string) {
  const rule = DISAMBIGUATION_RULES.find((r) => r.intentName === intent);
  if (!rule) throw new Error(`missing rule ${intent}`);
  return rule.check(transcript);
}

describe("311 disambiguation", () => {
  it("infers pothole vs sinkhole", () => {
    expect(run("ReportRoadsInfrastructure", "There is a pothole on Main Street")?.inferredSubIssue).toBe(
      "POTHOLE",
    );
    expect(run("ReportRoadsInfrastructure", "The road is collapsing into a sinkhole")?.elevated).toBe(true);
  });

  it("asks when water on the street is ambiguous", () => {
    const r = run("ReportWaterSewerDrainage", "There is water on my street");
    expect(r?.clarificationQuestion).toMatch(/bubbling/i);
  });

  it("maps barking dog to animal control sub-issue", () => {
    expect(run("ReportNoiseComplaint", "My neighbor's dog won't stop barking")?.inferredSubIssue).toBe(
      "DOG_BARKING",
    );
  });
});
