import { describe, it, expect } from "vitest";
import { normalizeAddressForIndex } from "./normalize-address.js";

describe("normalizeAddressForIndex", () => {
  it("lowercases, collapses space, and abbreviates common tokens", () => {
    expect(normalizeAddressForIndex("  100 Main Street, Apt #4  ")).toBe("100 main st apt 4");
  });

  it("treats punctuation-only differences as the same key", () => {
    const a = normalizeAddressForIndex("100 Main St.");
    const b = normalizeAddressForIndex("100, Main, Street");
    expect(a).toBe(b);
  });
});
