import { describe, expect, it } from "vitest";
import {
  parseAnnotationReview,
  parseSceneAlertFilter,
  parseWeeklyPatternNote,
} from "./scene-claude-roles.js";

describe("scene Claude role parsers", () => {
  it("keeps a Haiku filter that marks a likely false positive", () => {
    const parsed = parseSceneAlertFilter(
      '```json\n{"keep":false,"readout":"Unverified: the shape is consistent with a tool.","reason":"tool"}\n```',
    );
    expect(parsed).toEqual({
      keep: false,
      readout: "Unverified: the shape is consistent with a tool.",
      reason: "tool",
    });
  });

  it("rejects a filter with no readout", () => {
    expect(parseSceneAlertFilter('{"keep":true}')).toBeNull();
  });

  it("reads a Sonnet annotation review", () => {
    expect(parseAnnotationReview('{"accept":true,"notes":"Box is on the object, not the person."}')).toEqual({
      accept: true,
      notes: "Box is on the object, not the person.",
    });
  });

  it("reads an Opus weekly note without treating it as an applied change", () => {
    const parsed = parseWeeklyPatternNote(
      '{"summary":"Most weapon alerts were dismissed.","thresholdNote":"A person should consider a higher review bar for this camera."}',
    );
    expect(parsed?.thresholdNote).toContain("person should");
  });
});
