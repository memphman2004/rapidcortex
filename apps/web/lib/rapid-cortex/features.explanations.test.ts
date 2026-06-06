import { describe, expect, it } from "vitest";
import { RAPID_CORTEX_FEATURES } from "./features";

describe("rapid cortex feature explanations", () => {
  it("requires short, operator, admin, and sales explanations for every feature", () => {
    for (const feature of RAPID_CORTEX_FEATURES) {
      expect(feature.shortDescription.trim().length).toBeGreaterThan(0);
      expect(feature.operatorExplanation.trim().length).toBeGreaterThan(0);
      expect(feature.adminExplanation.trim().length).toBeGreaterThan(0);
      expect(feature.salesExplanation.trim().length).toBeGreaterThan(0);
    }
  });
});
