import { describe, expect, it } from "vitest";
import { NEXIQ_PRODUCT_NAME, nexiqSpokenSsml } from "./product-name.js";

describe("Nexiq product name", () => {
  it("spells the product Nexiq and speaks it Nex-ic", () => {
    expect(NEXIQ_PRODUCT_NAME).toBe("Nexiq");
    const spoken = nexiqSpokenSsml("You've reached Nexiq.");
    expect(spoken).toContain('ph="ˈnɛksɪk"');
    expect(spoken).toContain(">Nexiq</phoneme>");
    expect(spoken).not.toContain("Nexiq.");
  });
});
