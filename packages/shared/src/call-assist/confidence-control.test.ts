import { describe, expect, it } from "vitest";
import {
  callTakerConfidenceRows,
  confidenceActionLabel,
  evaluateConfidenceDecision,
  shouldTryBedrockFallback,
} from "./confidence-control.js";

describe("Call Assist confidence control plane", () => {
  it("escalates below the agency escalate threshold", () => {
    const d = evaluateConfidenceDecision({
      score: 0.4,
      source: "lex",
      thresholds: { emergency: 0.7, escalate: 0.55, selfService: 0.8 },
    });
    expect(d.action).toBe("escalate_human");
    expect(d.belowEscalate).toBe(true);
  });

  it("continues with review between escalate and self-service", () => {
    const d = evaluateConfidenceDecision({
      score: 0.65,
      source: "bedrock",
      thresholds: { emergency: 0.7, escalate: 0.55, selfService: 0.8 },
    });
    expect(d.action).toBe("continue_review");
    expect(d.belowSelfService).toBe(true);
  });

  it("allows self-service at or above the self-service floor", () => {
    const d = evaluateConfidenceDecision({ score: 0.88, source: "lex" });
    expect(d.action).toBe("self_service");
  });

  it("tries Bedrock when Lex is below self-service or on fallback", () => {
    expect(
      shouldTryBedrockFallback({
        lexConfidence: 0.5,
        intentName: "NoiseComplaint",
        fallbackIntentName: "FallbackIntent",
      }),
    ).toBe(true);
    expect(
      shouldTryBedrockFallback({
        lexConfidence: 0.95,
        intentName: "FallbackIntent",
        fallbackIntentName: "FallbackIntent",
      }),
    ).toBe(true);
    expect(
      shouldTryBedrockFallback({
        lexConfidence: 0.95,
        intentName: "NoiseComplaint",
        fallbackIntentName: "FallbackIntent",
      }),
    ).toBe(false);
  });

  it("exposes intent, classification, location, and routing scores for the call-taker", () => {
    const rows = callTakerConfidenceRows({
      intentScore: 0.91,
      classificationScore: 0.72,
      addressConfidence: 0.4,
      locationSource: "CALLER",
      locationText: "4200 Main",
      routingDestinationType: "QUEUE",
      classification: "NOISE_COMPLAINT",
      thresholds: { emergency: 0.7, escalate: 0.55, selfService: 0.8 },
    });
    expect(rows.map((r) => r.id)).toEqual(["intent", "classification", "location", "routing"]);
    expect(rows[0]?.action).toBe("self_service");
    expect(rows[1]?.action).toBe("continue_review");
    expect(rows[2]?.action).toBe("escalate_human");
    expect(confidenceActionLabel("escalate_human")).toBe("Escalate");
  });
});
