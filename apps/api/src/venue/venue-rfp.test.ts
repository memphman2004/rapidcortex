import { describe, expect, it } from "vitest";
import { previewCaseStatus } from "./venue-case-service.js";
import { sha256Hex } from "./venue-evidence-service.js";

describe("venue case transitions", () => {
  it("maps actions to lifecycle statuses", () => {
    expect(previewCaseStatus("open", "assign")).toBe("assigned");
    expect(previewCaseStatus("assigned", "investigate")).toBe("responding");
    expect(previewCaseStatus("responding", "escalate")).toBe("escalated");
    expect(previewCaseStatus("responding", "submit_for_approval")).toBe("pending_approval");
    expect(previewCaseStatus("pending_approval", "approve")).toBe("approved");
    expect(previewCaseStatus("approved", "close")).toBe("closed");
    expect(previewCaseStatus("closed", "reopen")).toBe("reopened");
  });
});

describe("venue evidence hash helper", () => {
  it("computes stable sha256 hex", () => {
    expect(sha256Hex(Buffer.from("nexcortiq-evidence"))).toMatch(/^[a-f0-9]{64}$/);
    expect(sha256Hex(Buffer.from("a"))).not.toBe(sha256Hex(Buffer.from("b")));
  });
});
