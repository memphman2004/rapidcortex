import { describe, expect, it } from "vitest";
import { normalizeAddress } from "./normalize-address.js";

describe("normalizeAddress", () => {
  it("uppercases and collapses whitespace", () => {
    expect(normalizeAddress("  123 Main Street  ")).toBe("123 MAIN ST");
  });

  it("strips punctuation", () => {
    expect(normalizeAddress("456 Oak Ave., Apt. #2")).toBe("456 OAK AVE APT 2");
  });
});
