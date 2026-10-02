import { describe, expect, it, vi } from "vitest";
import { evaluateRmsDraftGate } from "./rms-draft.js";

describe("Call Assist RMS draft gate", () => {
  it("blocks live filing when the fail-closed flag is off", () => {
    expect(
      evaluateRmsDraftGate({ rmsDraftEnabled: false, humanReviewApproved: true, demo: false }),
    ).toEqual({
      ok: false,
      blocked: true,
      reason: "call_assist_rms_draft_disabled",
    });
  });

  it("allows demo mock filing", () => {
    const result = evaluateRmsDraftGate({ rmsDraftEnabled: false, humanReviewApproved: false, demo: true });
    expect(result.ok).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.reason).toBe("demo_mock_rms");
  });
});
