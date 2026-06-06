import { describe, expect, it } from "vitest";
import {
  calculateDistanceBetweenPoints,
  calculateLocationConfidence,
  calculateMovementDirection,
  metersPerSecondToMph,
} from "./location-utils.js";

describe("pinpoint location-utils", () => {
  it("classifies confidence by accuracy", () => {
    expect(calculateLocationConfidence(10)).toBe("high");
    expect(calculateLocationConfidence(50)).toBe("medium");
    expect(calculateLocationConfidence(200)).toBe("low");
  });

  it("maps heading to compass direction", () => {
    expect(calculateMovementDirection(0)).toBe("N");
    expect(calculateMovementDirection(90)).toBe("E");
  });

  it("converts speed to mph", () => {
    expect(metersPerSecondToMph(10)).toBeCloseTo(22.3694, 2);
  });

  it("computes distance between points", () => {
    const d = calculateDistanceBetweenPoints(27.3364, -82.5306, 27.3374, -82.5306);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });
});
