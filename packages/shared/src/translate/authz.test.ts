import { describe, expect, it } from "vitest";
import type { UserContext } from "../types.js";
import {
  canMonitorTranslateSessionCampus,
  canStartTranslateSession,
  canStartTranslateSessionCampus,
  canStartTranslateSessionForVertical,
  canStartTranslateSessionHospital,
  canStartTranslateSessionVenue,
} from "./authz.js";
import { matchesTranslateAddon } from "./addon.js";
import { HOSPITAL_PHRASES, interpolateTranslatePhrase, VENUE_PHRASES } from "./types.js";

function user(role: string, agencyId = "kcpd"): UserContext {
  return {
    userId: "u1",
    agencyId,
    role: role as UserContext["role"],
    email: "u@example.com",
  };
}

describe("RC Translate RBAC", () => {
  it("allows dispatcher to start LE sessions in-agency", () => {
    expect(canStartTranslateSession(user("dispatcher"), "kcpd")).toBe(true);
    expect(canStartTranslateSession(user("dispatcher"), "other")).toBe(false);
  });

  it("rejects venue staff from LE start", () => {
    expect(canStartTranslateSession(user("VENUE_OPERATOR"), "kcpd")).toBe(false);
  });

  it("allows canonical venue roles to start venue sessions", () => {
    expect(canStartTranslateSessionVenue(user("VENUE_SUPERVISOR"), "kcpd")).toBe(true);
    expect(canStartTranslateSessionVenue(user("VENUE_OPERATOR"), "kcpd")).toBe(true);
    expect(canStartTranslateSessionVenue(user("VENUE_GUEST_SERVICES"), "kcpd")).toBe(false);
  });

  it("normalizes uppercase campus Cognito groups", () => {
    expect(canStartTranslateSessionCampus(user("CAMPUS_SECURITY"), "kcpd")).toBe(true);
    expect(canStartTranslateSessionCampus(user("CAMPUS_FACULTY"), "kcpd")).toBe(false);
    expect(canMonitorTranslateSessionCampus(user("campus_security"), "kcpd")).toBe(true);
    expect(canMonitorTranslateSessionCampus(user("CAMPUS_DISPATCH"), "kcpd")).toBe(true);
    expect(canMonitorTranslateSessionCampus(user("CAMPUS_FACULTY"), "kcpd")).toBe(true);
  });

  it("allows hospitalstaff JWT and HOSPITAL_STAFF group", () => {
    expect(canStartTranslateSessionHospital(user("hospitalstaff"), "kcpd")).toBe(true);
    expect(canStartTranslateSessionHospital(user("HOSPITAL_STAFF"), "kcpd")).toBe(true);
  });

  it("resolves vertical start checks", () => {
    expect(canStartTranslateSessionForVertical(user("dispatcher"), "kcpd", "law_enforcement")).toBe(
      true,
    );
    expect(canStartTranslateSessionForVertical(user("dispatcher"), "kcpd", "venue")).toBe(false);
  });
});

describe("RC Translate addon matching", () => {
  it("does not let venue SKU satisfy law enforcement", () => {
    expect(matchesTranslateAddon(["rc.translate.venue"], "law_enforcement")).toBe(false);
    expect(matchesTranslateAddon(["rc.translate.venue"], "venue")).toBe(true);
  });

  it("accepts legacy live translation SKUs for LE only", () => {
    expect(matchesTranslateAddon(["translation.live.tier2"], "law_enforcement")).toBe(true);
    expect(matchesTranslateAddon(["translation.live.tier2"], "hospital")).toBe(false);
  });
});

describe("phrase packs", () => {
  it("ships 10 venue and 12 hospital phrases", () => {
    expect(VENUE_PHRASES).toHaveLength(10);
    expect(HOSPITAL_PHRASES).toHaveLength(12);
  });

  it("interpolates section and name placeholders", () => {
    expect(interpolateTranslatePhrase("Your seat is in section {section}.", { section: "112" })).toBe(
      "Your seat is in section 112.",
    );
    expect(interpolateTranslatePhrase("My name is {name}.", { name: "Dr. Lee" })).toBe(
      "My name is Dr. Lee.",
    );
  });
});
