import { describe, expect, it } from "vitest";
import { RcLiteIntelligenceEnvelopeSchema } from "./intelligence-envelope.js";

describe("RcLiteIntelligenceEnvelopeSchema", () => {
  it("validates supervisor review workflow examples", () => {
    const payload = {
      model: "gpt-x-safety-pack",
      confidence: 0.76,
      reasoningSummary: "Caller references weapons + children audible.",
      keywords: ["domestic"],
      riskFactors: ["weapon"],
      missingInformation: ["exact unit number"],
      recommendedQuestions: ["Is anyone injured?"],
      suggestedDispatcherNotes: ["Coordinate PD + FD jointly."],
      doNotAutomate: true,
      review: {
        status: "manual_review_required",
        reason: "Low confidence CAD export mapping",
        confidence: 0.71,
        recommendedReviewerRole: "supervisor",
      },
    } as const;

    const parsed = RcLiteIntelligenceEnvelopeSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.doNotAutomate).toBe(true);
    }
  });
});
