import { describe, expect, it } from "vitest";
import {
  assertCampusAlertsHigherEdCampus,
  canInitiateCampusAlertsEmergencySms,
  isCampusAlertsFeatureEnabled,
  isCampusAlertsHigherEdCampus,
} from "./gates.js";

describe("Campus Alerts eligibility", () => {
  it("allows higher_ed campus", () => {
    expect(
      isCampusAlertsHigherEdCampus({
        vertical: "campus",
        agencyType: "campus",
        institutionType: "higher_ed",
      }),
    ).toBe(true);
  });

  it("denies k12 and other verticals", () => {
    expect(
      isCampusAlertsHigherEdCampus({ vertical: "campus", institutionType: "k12" }),
    ).toBe(false);
    expect(isCampusAlertsHigherEdCampus({ agencyType: "venue" })).toBe(false);
    expect(isCampusAlertsHigherEdCampus({ vertical: "transit" })).toBe(false);
    expect(() =>
      assertCampusAlertsHigherEdCampus({ vertical: "campus", institutionType: "k12" }),
    ).toThrow(/CAMPUS_ALERTS_NOT_AVAILABLE/);
  });

  it("is fail-closed on platform / tenant flags", () => {
    expect(
      isCampusAlertsFeatureEnabled({
        platformEnabled: false,
        tenantEnabled: true,
        vertical: "campus",
        institutionType: "higher_ed",
      }),
    ).toBe(false);
    expect(
      isCampusAlertsFeatureEnabled({
        platformEnabled: true,
        tenantEnabled: true,
        selfRegistrationEnabled: false,
        vertical: "campus",
        institutionType: "higher_ed",
      }),
    ).toBe(false);
    expect(
      isCampusAlertsFeatureEnabled({
        platformEnabled: true,
        tenantEnabled: true,
        vertical: "campus",
        institutionType: "higher_ed",
      }),
    ).toBe(true);
  });

  it("limits emergency mass SMS initiation roles", () => {
    expect(canInitiateCampusAlertsEmergencySms("CAMPUS_ADMIN")).toBe(true);
    expect(canInitiateCampusAlertsEmergencySms("CAMPUS_SECURITY")).toBe(false);
    expect(canInitiateCampusAlertsEmergencySms("VENUE_ADMIN")).toBe(false);
  });
});
