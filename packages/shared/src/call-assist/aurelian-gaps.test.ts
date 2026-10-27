import { describe, expect, it } from "vitest";
import { parseCallerSurveyScore } from "./caller-survey.js";
import { isLocationSlot, locationReadback } from "./location-readback.js";
import { surgeCompletesInsteadOfTransfer } from "./surge-mode.js";

describe("Aurelian gaps Nexiq closes on the call", () => {
  it("reads a street address back once", () => {
    expect(isLocationSlot("NoiseLocation")).toBe(true);
    expect(isLocationSlot("CallerName")).toBe(false);
    expect(locationReadback("4200 Main Street")).toBe(
      "I have the location as 4200 Main Street. Is that right?",
    );
    expect(locationReadback("the music is loud")).toBeNull();
  });

  it("keeps non-urgent surge calls and still transfers emergencies and human requests", () => {
    expect(surgeCompletesInsteadOfTransfer({ surgeMode: true, reason: "EXTERNAL_311" })).toBe(true);
    expect(surgeCompletesInsteadOfTransfer({ surgeMode: true, reason: "LOW_CONFIDENCE" })).toBe(true);
    expect(surgeCompletesInsteadOfTransfer({ surgeMode: true, reason: "EMERGENCY" })).toBe(false);
    expect(surgeCompletesInsteadOfTransfer({ surgeMode: true, reason: "HUMAN_REQUEST" })).toBe(false);
    expect(surgeCompletesInsteadOfTransfer({ surgeMode: false, reason: "EXTERNAL_311" })).toBe(false);
  });

  it("accepts only a one-digit survey reply", () => {
    expect(parseCallerSurveyScore("5")).toBe(5);
    expect(parseCallerSurveyScore("1 pothole on Main")).toBeNull();
    expect(parseCallerSurveyScore("0")).toBeNull();
  });
});
