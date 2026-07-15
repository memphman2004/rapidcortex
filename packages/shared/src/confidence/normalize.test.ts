import { describe, expect, it } from "vitest";
import {
  confidenceToDisplayPercent,
  normalizeConfidence01,
  normalizeConfidencePercent,
} from "./normalize.js";

describe("normalizeConfidence01", () => {
  it("passes through 0–1", () => {
    expect(normalizeConfidence01(0.85)).toBe(0.85);
    expect(normalizeConfidence01(0)).toBe(0);
    expect(normalizeConfidence01(1)).toBe(1);
  });

  it("converts 0–100 model output", () => {
    expect(normalizeConfidence01(85)).toBe(0.85);
    expect(normalizeConfidence01(100)).toBe(1);
  });

  it("clamps and rejects non-finite", () => {
    expect(normalizeConfidence01(-1)).toBe(0);
    expect(normalizeConfidence01(150)).toBe(1);
    expect(normalizeConfidence01(Number.NaN)).toBe(0);
  });
});

describe("normalizeConfidencePercent", () => {
  it("passes through 0–100 integers", () => {
    expect(normalizeConfidencePercent(85)).toBe(85);
    expect(normalizeConfidencePercent(0)).toBe(0);
    expect(normalizeConfidencePercent(100)).toBe(100);
  });

  it("converts fraction scores that would otherwise show as 1%", () => {
    expect(normalizeConfidencePercent(0.85)).toBe(85);
    expect(normalizeConfidencePercent(1)).toBe(100);
    expect(normalizeConfidencePercent(0.01)).toBe(1);
  });
});

describe("confidenceToDisplayPercent", () => {
  it("handles both scales for UI", () => {
    expect(confidenceToDisplayPercent(0.88)).toBe(88);
    expect(confidenceToDisplayPercent(88)).toBe(88);
    expect(confidenceToDisplayPercent(1)).toBe(100);
  });
});
