import { describe, expect, it } from "vitest";
import {
  canScoreCallAssistContentWithBedrock,
  isCallAssistCallQualityScoringEnabled,
  isCallAssistCjisAiAuthorized,
} from "./cjis-ai-gate.js";

describe("Call Assist CJIS AI gate", () => {
  it("preserves live behavior when flags are unset", () => {
    expect(isCallAssistCjisAiAuthorized(undefined)).toBe(true);
    expect(isCallAssistCallQualityScoringEnabled({})).toBe(true);
    expect(canScoreCallAssistContentWithBedrock(null)).toBe(true);
  });

  it("blocks Bedrock content scoring when cjisAiAuthorized is false", () => {
    expect(canScoreCallAssistContentWithBedrock({ cjisAiAuthorized: false })).toBe(false);
  });

  it("blocks when callQualityScoringEnabled is false", () => {
    expect(
      canScoreCallAssistContentWithBedrock({
        cjisAiAuthorized: true,
        callQualityScoringEnabled: false,
      }),
    ).toBe(false);
  });

  it("allows when both flags are explicitly true", () => {
    expect(
      canScoreCallAssistContentWithBedrock({
        cjisAiAuthorized: true,
        callQualityScoringEnabled: true,
      }),
    ).toBe(true);
  });
});
