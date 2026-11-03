import { describe, expect, it } from "vitest";
import { SALES_CALL_COACH_MIN_TRANSCRIPT } from "rapid-cortex-shared";

describe("CallTranscriptCoach analyze gate", () => {
  it("requires minimum transcript length before analyze", () => {
    expect("short".length < SALES_CALL_COACH_MIN_TRANSCRIPT).toBe(true);
    expect("x".repeat(SALES_CALL_COACH_MIN_TRANSCRIPT).length >= SALES_CALL_COACH_MIN_TRANSCRIPT).toBe(
      true,
    );
  });
});
