import { describe, expect, it } from "vitest";
import {
  applyAdaptiveEndpointing,
  resolveEndpointingProfile,
} from "./adaptive-endpointing.js";

describe("Call Assist Phase 2 — adaptive endpointing", () => {
  it("uses a longer end-timeout for mid-correction", () => {
    const result = applyAdaptiveEndpointing({
      utterance: "It's a Toyota — wait, Honda",
      hadCorrectionCue: true,
    });
    expect(result.profile).toBe("correction");
    expect(result.endTimeoutMs).toBeGreaterThanOrEqual(1600);
    expect(result.sessionPatch["x-amz-lex:audio:end-timeout-ms"]).toBe(String(result.endTimeoutMs));
    expect(result.sessionPatch.waitingForFinalValue).toBe("1");
  });

  it("stays patient for hesitation and snappy for short yes/no", () => {
    expect(resolveEndpointingProfile({ utterance: "um let me think" })).toBe("patient");
    expect(resolveEndpointingProfile({ utterance: "yes" })).toBe("snappy");
    expect(resolveEndpointingProfile({ utterance: "4200 Main Street near the park" })).toBe("default");
  });
});
