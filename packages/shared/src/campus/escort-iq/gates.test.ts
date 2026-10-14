import { describe, expect, it } from "vitest";
import { assertEscortIqHigherEdCampus, isEscortIqEnabled, isEscortIqHigherEdCampus } from "./gates.js";

describe("Escort iQ eligibility", () => {
  it("allows higher_ed campus", () => {
    expect(
      isEscortIqHigherEdCampus({
        vertical: "campus",
        agencyType: "campus",
        institutionType: "higher_ed",
      }),
    ).toBe(true);
  });

  it("denies k12", () => {
    expect(
      isEscortIqHigherEdCampus({
        vertical: "campus",
        institutionType: "k12",
      }),
    ).toBe(false);
    expect(() =>
      assertEscortIqHigherEdCampus({ vertical: "campus", institutionType: "k12" }),
    ).toThrow(/ESCORT_IQ_NOT_AVAILABLE/);
  });

  it("denies venue / transit / psap-like agency types", () => {
    expect(isEscortIqHigherEdCampus({ agencyType: "venue", institutionType: "higher_ed" })).toBe(
      false,
    );
    expect(isEscortIqHigherEdCampus({ vertical: "transit" })).toBe(false);
    expect(isEscortIqHigherEdCampus({ agencyType: "city" })).toBe(false);
  });

  it("requires platform flag (fail-closed) and respects tenant off", () => {
    expect(
      isEscortIqEnabled({
        platformEnabled: false,
        tenantEnabled: true,
        vertical: "campus",
        institutionType: "higher_ed",
      }),
    ).toBe(false);
    expect(
      isEscortIqEnabled({
        platformEnabled: true,
        tenantEnabled: false,
        vertical: "campus",
        institutionType: "higher_ed",
      }),
    ).toBe(false);
    expect(
      isEscortIqEnabled({
        platformEnabled: true,
        tenantEnabled: true,
        vertical: "campus",
        institutionType: "higher_ed",
      }),
    ).toBe(true);
  });
});
