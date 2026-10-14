import { describe, expect, it } from "vitest";
import { estimateEmergencyBroadcastCost, estimateSmsSegments } from "./sms-cost.js";

describe("campus alerts SMS cost estimates", () => {
  it("counts single GSM-7 segment under 160 chars", () => {
    const r = estimateSmsSegments("Campus emergency. Shelter in place.");
    expect(r.encoding).toBe("gsm7");
    expect(r.segmentsPerMessage).toBe(1);
  });

  it("counts multipart GSM-7", () => {
    const body = "A".repeat(200);
    const r = estimateSmsSegments(body);
    expect(r.encoding).toBe("gsm7");
    expect(r.segmentsPerMessage).toBe(2);
  });

  it("uses UCS-2 for emoji / non-GSM", () => {
    const r = estimateSmsSegments("Emergency 🚨 stay inside");
    expect(r.encoding).toBe("ucs2");
  });

  it("multiplies recipients × segments for estimate", () => {
    const cost = estimateEmergencyBroadcastCost({
      messageBody: "A".repeat(200),
      recipientCount: 1000,
      ratePerSegmentUsd: 0.01,
    });
    expect(cost.segmentsPerMessage).toBe(2);
    expect(cost.estimatedSegments).toBe(2000);
    expect(cost.estimatedTotalCostUsd).toBe(20);
  });
});
