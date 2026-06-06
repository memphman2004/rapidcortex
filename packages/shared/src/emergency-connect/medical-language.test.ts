import { describe, expect, it } from "vitest";
import { validateQualifiedMedicalLanguage } from "./medical-language.js";

describe("validateQualifiedMedicalLanguage", () => {
  it("accepts qualified phrasing", () => {
    expect(validateQualifiedMedicalLanguage("Possible stroke symptoms")).toEqual([]);
    expect(validateQualifiedMedicalLanguage("Suspected cardiac event")).toEqual([]);
  });

  it("flags definitive diagnosis language", () => {
    const issues = validateQualifiedMedicalLanguage("Patient has stroke");
    expect(issues.length).toBeGreaterThan(0);
  });
});
