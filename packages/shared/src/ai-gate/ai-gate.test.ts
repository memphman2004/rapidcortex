import { describe, expect, it } from "vitest";
import {
  applyToggle,
  defaultAIGateConfig,
  isAIGateFeatureOn,
} from "./types.js";

describe("AI feature gate applyToggle", () => {
  it("defaults to all AI on", () => {
    const cfg = defaultAIGateConfig("agency-1");
    expect(cfg.aiEnabled).toBe(true);
    expect(isAIGateFeatureOn(cfg, "transcription")).toBe(true);
  });

  it("master off forces every feature false", () => {
    const current = defaultAIGateConfig("agency-1");
    const next = applyToggle(
      current,
      { enabled: false, reason: "drill", features: { transcription: true } },
      "user-1",
    );
    expect(next.aiEnabled).toBe(false);
    expect(Object.values(next.features).every((v) => v === false)).toBe(true);
    expect(next.toggleReason).toBe("drill");
    expect(next.toggledBy).toBe("user-1");
  });

  it("master on merges partial feature overrides", () => {
    const current = defaultAIGateConfig("agency-1");
    const next = applyToggle(
      current,
      { enabled: true, features: { cameraAnalysis: false } },
      "user-2",
    );
    expect(next.aiEnabled).toBe(true);
    expect(next.features.cameraAnalysis).toBe(false);
    expect(next.features.transcription).toBe(true);
  });
});
