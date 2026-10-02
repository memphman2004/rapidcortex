import { describe, expect, it } from "vitest";
import { mockClassify } from "./classifier.js";
import type { TriageAnalyzeEvent } from "rapid-cortex-shared";

function baseEvent(overrides: Partial<TriageAnalyzeEvent> = {}): TriageAnalyzeEvent {
  return {
    agencyId: "test-agency",
    incidentId: "inc-123",
    agencyName: "Test",
    segments: [{ speaker: "caller", text: "Help me", startMs: 0 }],
    agencyTriageConfig: { enabled: true, nonEmergencyQueueEnabled: true },
    ...overrides,
  };
}

describe("mockClassify", () => {
  it("defaults to EMERGENCY", () => {
    const result = mockClassify(baseEvent());
    expect(result.classification).toBe("EMERGENCY");
    expect(result.mock).toBe(true);
  });

  it("classifies NON_EMERGENCY from incident id hint", () => {
    const result = mockClassify(baseEvent({ incidentId: "call-nonemerg-1" }));
    expect(result.classification).toBe("NON_EMERGENCY");
  });

  it("classifies NON_EMERGENCY from noise-complaint transcript language", () => {
    const result = mockClassify(
      baseEvent({
        segments: [
          {
            speaker: "caller",
            text: "Hi, this is a noise complaint — loud music, not an emergency.",
            startMs: 0,
          },
        ],
      }),
    );
    expect(result.classification).toBe("NON_EMERGENCY");
    expect(result.suggestedCategory).toBe("Noise Complaint");
  });
});
