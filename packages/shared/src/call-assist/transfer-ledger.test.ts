import { describe, expect, it } from "vitest";
import { applyTransferOutcome, isOpenTransferAttempt, nextTransferAttempt, summarizeTransferLedger } from "./transfer-ledger.js";

describe("transfer outcome ledger", () => {
  it("tracks attempts, open state, and outcomes", () => {
    const first = {
      ledgerId: "l1",
      agencyId: "a1",
      sessionId: "s1",
      attempt: 1,
      destinationType: "EXTERNAL_AGENCY" as const,
      destinationId: "kc-water",
      destinationDisplay: "Water",
      channel: "PSTN" as const,
      outcome: "INITIATED" as const,
      startedAt: "t1",
    };
    expect(isOpenTransferAttempt(first)).toBe(true);
    expect(nextTransferAttempt([first])).toBe(2);
    const failed = applyTransferOutcome(first, "FAILED", { failureReason: "no_answer" });
    expect(failed.outcome).toBe("FAILED");
    const summary = summarizeTransferLedger([failed]);
    expect(summary.failed).toBe(1);
    expect(summary.lastOutcome).toBe("FAILED");
  });
});
