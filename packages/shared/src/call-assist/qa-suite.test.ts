import { describe, expect, it } from "vitest";
import {
  compareAiVsHuman,
  detectFalseTransfer,
  scoreCallAssistTranscriptMock,
  searchCallAssistTranscript,
  summarizeCallAssistQa,
} from "./qa-suite.js";

describe("Call Assist QA suite", () => {
  it("searches utterances and scores a mock checklist", () => {
    const utterances = [
      { speaker: "assistant", text: "I'm an automated assistant. This call may be recorded." },
      { speaker: "caller", text: "Abandoned vehicle at 1200 Main Street yesterday." },
    ];
    expect(searchCallAssistTranscript(utterances, "Main")).toHaveLength(1);
    const scored = scoreCallAssistTranscriptMock(utterances);
    expect(scored.aggregateScore).toBeGreaterThan(40);
    expect(scored.checklist.some((c) => c.id === "disclosure" && c.passed)).toBe(true);
  });

  it("flags historical non-emergency 911 transfers as false transfers", () => {
    expect(
      detectFalseTransfer({
        state: "TRANSFERRING_911",
        emergencyDetected: false,
        classification: "REPORT_ONLY",
        utterances: [{ speaker: "caller", text: "it happened yesterday" }],
      }),
    ).toBe(true);
    expect(
      detectFalseTransfer({
        state: "TRANSFERRING_911",
        emergencyDetected: true,
        classification: "EMERGENCY",
        utterances: [{ speaker: "caller", text: "he has a gun" }],
      }),
    ).toBe(false);
  });

  it("compares AI vs human scores", () => {
    expect(compareAiVsHuman(80, 82).aligned).toBe(true);
    expect(compareAiVsHuman(50, 90).aligned).toBe(false);
    const dash = summarizeCallAssistQa([
      {
        reviewId: "r1",
        agencyId: "a",
        sessionId: "s",
        source: "ai",
        aggregateScore: 70,
        checklist: [],
        falseTransfer: true,
        createdAt: "t",
        updatedAt: "t",
        keywordHits: ["weapon"],
      },
    ]);
    expect(dash.falseTransferCount).toBe(1);
    expect(dash.keywordTop[0]?.term).toBe("weapon");
  });
});
