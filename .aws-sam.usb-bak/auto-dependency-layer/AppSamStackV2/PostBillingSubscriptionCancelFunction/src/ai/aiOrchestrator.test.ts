import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { TranscriptSegment } from "rapid-cortex-shared";
import { runAiAnalysisOrchestrator } from "./aiOrchestrator.js";
import { resetAiRuntimeConfigCacheForTests } from "./aiConfig.js";

describe("runAiAnalysisOrchestrator", () => {
  beforeEach(() => {
    resetAiRuntimeConfigCacheForTests();
    process.env.PRIMARY_PROVIDER = "mock";
    process.env.SECONDARY_PROVIDER = "mock";
    process.env.TERTIARY_PROVIDER = "off";
    process.env.AI_ENABLE_FALLBACKS = "true";
    process.env.DEPLOYMENT_STAGE = "dev";
    process.env.AI_MAX_RETRIES_PER_PROVIDER = "0";
  });

  afterEach(() => {
    resetAiRuntimeConfigCacheForTests();
  });

  it("returns success with mock primary", async () => {
    const seg: TranscriptSegment = {
      segmentId: "s1",
      incidentId: "inc1",
      agencyId: "agency1",
      speaker: "caller",
      text: "smoke in the hallway",
      timestamp: new Date().toISOString(),
    };
    const res = await runAiAnalysisOrchestrator({
      incidentId: "inc1",
      agencyId: "agency1",
      transcript: [seg],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.output.category).toBe("fire");
      expect(res.fallbackCount).toBe(0);
      expect(res.winner.providerKind).toBe("mock");
    }
  });

  it("returns disabled when chain is empty", async () => {
    process.env.PRIMARY_PROVIDER = "off";
    process.env.SECONDARY_PROVIDER = "off";
    process.env.TERTIARY_PROVIDER = "off";
    process.env.AI_ENABLE_FALLBACKS = "true";
    resetAiRuntimeConfigCacheForTests();
    const res = await runAiAnalysisOrchestrator({
      incidentId: "inc1",
      agencyId: "agency1",
      transcript: [],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("AI_DISABLED");
    }
  });
});
