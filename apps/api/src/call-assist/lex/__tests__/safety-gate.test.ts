import { describe, expect, it } from "vitest";
import { buildTransferSummary, runSafetyGate, transferSummaryReasonLabel } from "../safety-gate.js";

describe("runSafetyGate", () => {
  it("is emergency on gun regardless of surrounding non-emergency framing", () => {
    expect(runSafetyGate("he has a gun").isEmergency).toBe(true);
    expect(runSafetyGate("suspicious person outside").isEmergency).toBe(false);
  });
});

describe("buildTransferSummary", () => {
  it("includes type, address, turns, reason, and language for the dispatcher pop", () => {
    const summary = buildTransferSummary(
      "there is a gun",
      { ServiceAddress: "4200 Main", incidentType: "weapons", CallerName: "Sam" },
      "KCPD",
      {
        transferReason: "emergency",
        language: "en-US",
        transcript: "Caller: hi|Assistant: ok|Caller: there is a gun",
      },
    );
    expect(summary).toContain("KCPD Nexiq transfer");
    expect(summary).toContain("Type: weapons");
    expect(summary).toContain("Address: 4200 Main");
    expect(summary).toContain("Caller: Sam");
    expect(summary).toContain("Language: en-US");
    expect(summary).toContain("Turns: 2");
    expect(summary).toContain("Reason: emergency");
    expect(summary).toContain("gun");
  });

  it("normalizes TransferReason enums for the pop", () => {
    expect(transferSummaryReasonLabel("HUMAN_REQUEST")).toBe("human_request");
    expect(transferSummaryReasonLabel(null)).toBe("emergency");
  });
});
