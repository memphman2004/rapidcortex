import { describe, expect, it } from "vitest";
import { demoDrainUtterance, isDemoTerminalState } from "./demo-runner.js";

describe("Call Assist demo runner", () => {
  it("keeps draining intake after a non-emergency follow-up", () => {
    expect(
      demoDrainUtterance({
        state: "INTAKE",
        continueAiConversation: true,
        lastQuestionId: "location",
        nextQuestion: "What is the address or closest intersection?",
      }),
    ).toBe("1200 Main Street");
    expect(
      demoDrainUtterance({
        state: "INTAKE",
        continueAiConversation: true,
        lastQuestionId: "apartment",
        nextQuestion: "Is there an apartment, suite, or unit number?",
      }),
    ).toBe("No unit number");
  });

  it("stops drain only on terminal states", () => {
    expect(isDemoTerminalState("TRANSFERRING_911")).toBe(true);
    expect(isDemoTerminalState("INTAKE")).toBe(false);
    expect(
      demoDrainUtterance({
        state: "TRANSFERRING_911",
        continueAiConversation: false,
        nextQuestion: null,
      }),
    ).toBeNull();
  });
});
