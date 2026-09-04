import { describe, expect, it } from "vitest";
import { intelFingerprint } from "./opportunity-intel-fingerprint.js";
import {
  intelFingerprintKey,
  intelStrategicPriority,
  normalizeIntelUrl,
  rapidIqIntelAiExtractionSchema,
  rapidIqIntelOpportunitySchema,
} from "./opportunity-intel-schemas.js";
import { RAPID_IQ_TRANSIT_WATCH_SEEDS } from "./transit-watches.js";

describe("intel fingerprint", () => {
  it("is stable for equivalent agency/title/due date", () => {
    const a = intelFingerprint({
      agency: "Los Angeles Metro",
      title: "CAD / Dispatch Modernization RFP",
      dueDate: "2026-11-01",
    });
    const b = intelFingerprint({
      agency: "los angeles metro",
      title: "CAD/Dispatch  Modernization   RFP",
      dueDate: "2026-11-01",
    });
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
  });

  it("changes when solicitation number differs", () => {
    const a = intelFingerprintKey({ agency: "WMATA", title: "Radio overlay", solicitationNumber: "R-1" });
    const b = intelFingerprintKey({ agency: "WMATA", title: "Radio overlay", solicitationNumber: "R-2" });
    expect(a).not.toBe(b);
  });

  it("normalizes source URLs", () => {
    expect(normalizeIntelUrl("https://www.Metro.net/path/?q=1#frag")).toBe(
      "https://metro.net/path?q=1",
    );
  });
});

describe("intel schema ranges", () => {
  it("rejects out-of-range scores", () => {
    const parsed = rapidIqIntelAiExtractionSchema.safeParse({
      agency: "CTA",
      title: "Test",
      opportunityType: "RFP",
      categories: [],
      rapidCortexProducts: ["TRANSIT"],
      fitScore: 11,
      winSignal: 5,
      confidence: 0.5,
      recommendation: "WATCH",
      procurementStage: 8,
      preRfpSignal: false,
      reason: "x",
      recommendedAction: "y",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a complete opportunity record", () => {
    const now = "2026-09-03T00:00:00.000Z";
    const parsed = rapidIqIntelOpportunitySchema.safeParse({
      id: "intel_1",
      agency: "CTA",
      market: "TRANSIT",
      title: "Transit police CAD overlay",
      opportunityType: "PRE_RFP_SIGNAL",
      sourceUrl: "https://example.com/agenda",
      categories: ["CAD"],
      rapidCortexProducts: ["TRANSIT", "CORE"],
      fitScore: 8.5,
      winSignal: 6,
      confidence: 0.7,
      recommendation: "WATCH",
      procurementStage: 3,
      preRfpSignal: true,
      reason: "Board agenda",
      recommendedAction: "Monitor CIP",
      discoveredAt: now,
      lastUpdatedAt: now,
      status: "NEW",
    });
    expect(parsed.success).toBe(true);
  });

  it("ranks pre-RFP high-fit above ignore", () => {
    const now = "2026-09-03T00:00:00.000Z";
    const base = {
      id: "x",
      agency: "CTA",
      market: "TRANSIT" as const,
      title: "t",
      opportunityType: "OTHER" as const,
      sourceUrl: "https://example.com",
      categories: [],
      rapidCortexProducts: ["TRANSIT" as const],
      confidence: 0.5,
      recommendation: "WATCH" as const,
      reason: "r",
      recommendedAction: "a",
      discoveredAt: now,
      lastUpdatedAt: now,
      status: "NEW" as const,
      winSignal: 5,
    };
    const high = rapidIqIntelOpportunitySchema.parse({
      ...base,
      fitScore: 9,
      procurementStage: 3,
      preRfpSignal: true,
    });
    const low = rapidIqIntelOpportunitySchema.parse({
      ...base,
      id: "y",
      fitScore: 2,
      procurementStage: 0,
      preRfpSignal: false,
      recommendation: "IGNORE",
    });
    expect(intelStrategicPriority(high)).toBeGreaterThan(intelStrategicPriority(low));
  });
});

describe("transit watch seeds", () => {
  it("includes 25 configuration-driven transit agencies", () => {
    expect(RAPID_IQ_TRANSIT_WATCH_SEEDS).toHaveLength(25);
    expect(new Set(RAPID_IQ_TRANSIT_WATCH_SEEDS.map((w) => w.id)).size).toBe(25);
  });
});
