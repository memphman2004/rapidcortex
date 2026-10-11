import { describe, expect, it } from "vitest";
import {
  canAccessNexiqSignals,
  nexiqSignalCreateBodySchema,
  nexiqSignalPatchBodySchema,
  NEXIQ_SIGNAL_MIN_CONFIDENCE,
} from "./schemas.js";

describe("canAccessNexiqSignals", () => {
  it("allows RC admin family and salescontractor (admin / bd_manager mapping)", () => {
    expect(canAccessNexiqSignals("rcsuperadmin")).toBe(true);
    expect(canAccessNexiqSignals("rcadmin")).toBe(true);
    expect(canAccessNexiqSignals("salescontractor")).toBe(true);
  });

  it("denies other roles", () => {
    expect(canAccessNexiqSignals("rcitadmin")).toBe(false);
    expect(canAccessNexiqSignals("dispatcher")).toBe(false);
    expect(canAccessNexiqSignals("agencyadmin")).toBe(false);
  });
});

describe("nexiqSignalCreateBodySchema", () => {
  it("requires title, vertical, agencyName, dedupeHash, confidenceScore", () => {
    const bad = nexiqSignalCreateBodySchema.safeParse({ title: "x" });
    expect(bad.success).toBe(false);

    const ok = nexiqSignalCreateBodySchema.safeParse({
      title: "CAD RFP",
      vertical: "core_psap",
      agencyName: "Forsyth County 911",
      geography: { state: "NC" },
      confidenceScore: 72,
      confidenceTier: "high",
      dedupeHash: "a".repeat(32),
    });
    expect(ok.success).toBe(true);
  });
});

describe("nexiqSignalPatchBodySchema", () => {
  it("accepts track dismiss push_to_crm", () => {
    expect(nexiqSignalPatchBodySchema.parse({ action: "track" }).action).toBe("track");
    expect(nexiqSignalPatchBodySchema.parse({ action: "dismiss" }).action).toBe("dismiss");
    expect(nexiqSignalPatchBodySchema.parse({ action: "push_to_crm" }).action).toBe("push_to_crm");
  });
});

describe("NEXIQ_SIGNAL_MIN_CONFIDENCE", () => {
  it("is 40", () => {
    expect(NEXIQ_SIGNAL_MIN_CONFIDENCE).toBe(40);
  });
});
