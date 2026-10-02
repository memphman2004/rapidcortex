import { describe, expect, it } from "vitest";
import { applyBargeIn, bargeInSessionPatch, detectBargeIn, readBargeInState } from "./barge-in.js";

describe("Call Assist barge-in resume", () => {
  it("increments barge-in count and keeps the next slot for resume", () => {
    const next = applyBargeIn({
      prior: readBargeInState({ promptSlot: "NoiseType", bargeInCount: "0" }),
      event: { interrupted: true, utterance: "music", at: "2026-09-08T12:00:00.000Z" },
      nextMissingSlot: "NoiseStillHappening",
    });
    expect(next.bargeInCount).toBe(1);
    expect(next.resumeSlot).toBe("NoiseStillHappening");
    expect(bargeInSessionPatch(next).bargeInEnabled).toBe("true");
  });

  it("detects interruption only when a prompt was active and unanswered", () => {
    expect(detectBargeIn({ promptSlot: "NoiseLocation" }, "4200 Main")).toBe(true);
    expect(detectBargeIn({ promptSlot: "NoiseLocation" }, "4200 Main", { promptedSlotFilled: true })).toBe(false);
    expect(detectBargeIn({ lexPromptActive: "1" }, "4200 Main")).toBe(false);
    expect(detectBargeIn({}, "4200 Main")).toBe(false);
  });
});
