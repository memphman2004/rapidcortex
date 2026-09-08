import { describe, expect, it } from "vitest";
import {
  isAmbiguousIntakeAnswer,
  nextIntakeQuestion,
  recordAskedQuestion,
  spokenIntakePrompt,
} from "./questioning.js";

describe("Call Assist dynamic questioning", () => {
  it("never asks after emergency", () => {
    expect(nextIntakeQuestion("EMERGENCY", {})).toBeNull();
  });

  it("asks location first, then never-repeats optional apt after one ask", () => {
    const first = nextIntakeQuestion("NOISE_COMPLAINT", {});
    expect(first?.id).toBe("location");
    const afterLocation = nextIntakeQuestion("NOISE_COMPLAINT", { locationText: "4200 Oak" });
    expect(afterLocation?.id).toBe("apartment");
    const skipped = nextIntakeQuestion(
      "NOISE_COMPLAINT",
      { locationText: "4200 Oak" },
      undefined,
      { askedQuestionIds: ["apartment"], lastQuestionId: "apartment", lastUtterance: "I don't know" },
    );
    expect(skipped?.id).not.toBe("apartment");
  });

  it("clarifies required fields when the answer is ambiguous", () => {
    const q = nextIntakeQuestion(
      "NOISE_COMPLAINT",
      { locationText: "4200 Oak", apartmentSuite: "2", crossStreets: "Oak and Main", isInProgress: true },
      undefined,
      { lastQuestionId: "callback", lastUtterance: "idk", askedQuestionIds: ["callback"] },
    );
    expect(q?.id).toBe("callback");
    expect(q?.clarify).toBe(true);
    expect(spokenIntakePrompt(q!, "es")).toMatch(/n[uú]mero/i);
  });

  it("treats skip/idk as ambiguous", () => {
    expect(isAmbiguousIntakeAnswer("idk")).toBe(true);
    expect(isAmbiguousIntakeAnswer("no sé")).toBe(true);
    expect(isAmbiguousIntakeAnswer("4200 Oak Street")).toBe(false);
  });

  it("speaks Spanish prompts when locale is es", () => {
    const q = nextIntakeQuestion("NOISE_COMPLAINT", {});
    expect(spokenIntakePrompt(q!, "es")).toMatch(/direcci[oó]n/i);
  });

  it("records asked ids without duplicates", () => {
    expect(recordAskedQuestion(["location"], "location")).toEqual(["location"]);
    expect(recordAskedQuestion(["location"], "apartment")).toEqual(["location", "apartment"]);
  });
});
