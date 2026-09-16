import { describe, expect, it } from "vitest";
import { demoDrainUtterance, isDemoTerminalState } from "./demo-runner.js";

describe("Call Assist demo drain", () => {
  it("treats transfer and completed as terminal", () => {
    expect(isDemoTerminalState("TRANSFERRING_911")).toBe(true);
    expect(isDemoTerminalState("TRANSFERRING_EXTERNAL")).toBe(true);
    expect(isDemoTerminalState("COMPLETED")).toBe(true);
    expect(isDemoTerminalState("INTAKE")).toBe(false);
  });

  it("answers leftover vehicle prompts instead of looping", () => {
    expect(
      demoDrainUtterance({
        state: "INTAKE",
        continueAiConversation: true,
        lastQuestionId: "vehicle",
        nextQuestion: "Do you have the vehicle make, model, color, or license plate?",
      }),
    ).toMatch(/Honda Civic/i);
    expect(
      demoDrainUtterance({
        state: "INTAKE",
        continueAiConversation: true,
        lastQuestionId: "vehicle_plate",
        nextQuestion: "Do you have a license plate number?",
      }),
    ).toMatch(/don't have the plate/i);
  });

  it("does not invent turns after the call is already transferred", () => {
    expect(
      demoDrainUtterance({
        state: "TRANSFERRING_911",
        continueAiConversation: false,
        lastQuestionId: "vehicle",
        nextQuestion: "Do you have the vehicle make, model, color, or license plate?",
      }),
    ).toBeNull();
  });
});
