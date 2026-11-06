import { describe, expect, it } from "vitest";
import {
  NEXCORTIQ_CONVERSATIONAL_QA_TAG,
  assignConversationalCohort,
  buildConversationalTransferSummary,
  conversationalTrafficBucket,
  countCallerTurns,
} from "./conversational-ops.js";

describe("conversational ops", () => {
  it("exports the QA recording tag", () => {
    expect(NEXCORTIQ_CONVERSATIONAL_QA_TAG).toBe("NexCortIQ-Conversational-v2");
  });

  it("splits traffic stably by contact id", () => {
    const a = assignConversationalCohort("contact-aaa");
    const b = assignConversationalCohort("contact-aaa");
    expect(a).toBe(b);
    expect(conversationalTrafficBucket("contact-aaa")).toBeGreaterThanOrEqual(0);
    expect(conversationalTrafficBucket("contact-aaa")).toBeLessThan(100);
    expect(assignConversationalCohort("x", 0)).toBe("production");
    expect(assignConversationalCohort("x", 100)).toBe("staging");
  });

  it("counts caller turns from the pipe transcript", () => {
    expect(countCallerTurns("Caller: hi|Assistant: ok|Caller: 4200 Main")).toBe(2);
    expect(countCallerTurns("")).toBe(0);
  });

  it("builds a rich dispatcher transfer summary", () => {
    const summary = buildConversationalTransferSummary({
      utterance: "there is a gun",
      agencyShortName: "KCPD",
      transferReason: "emergency",
      language: "en-US",
      turnCount: 3,
      slots: {
        ServiceAddress: "4200 Main",
        incidentType: "weapons",
        CallerName: "Sam",
      },
    });
    expect(summary).toContain("KCPD Nexiq transfer");
    expect(summary).toContain("Type: weapons");
    expect(summary).toContain("Address: 4200 Main");
    expect(summary).toContain("Caller: Sam");
    expect(summary).toContain("Language: en-US");
    expect(summary).toContain("Turns: 3");
    expect(summary).toContain("Reason: emergency");
    expect(summary).toContain("gun");
  });
});
