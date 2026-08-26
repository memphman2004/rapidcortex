import { describe, expect, it } from "vitest";
import { clampSplitRatio } from "./ResizableMapSplit";

describe("clampSplitRatio", () => {
  it("keeps the split between 30% and 70%", () => {
    expect(clampSplitRatio(0.5)).toBe(0.5);
    expect(clampSplitRatio(0.1)).toBe(0.3);
    expect(clampSplitRatio(0.95)).toBe(0.7);
    expect(clampSplitRatio(Number.NaN)).toBe(0.5);
  });
});
