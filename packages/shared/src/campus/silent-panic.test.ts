import { describe, expect, it } from "vitest";
import {
  canActivateSilentPanic,
  canOperateSilentPanic,
  isSilentPanicCampus,
  silentPanicIncidentDescription,
} from "./silent-panic.js";

describe("silent panic", () => {
  it("lets K-12 admin, security, and dispatch activate", () => {
    expect(canActivateSilentPanic("CAMPUS_ADMIN_K12")).toBe(true);
    expect(canActivateSilentPanic("campus_security_k12")).toBe(true);
    expect(canActivateSilentPanic("CAMPUS_DISPATCH_K12")).toBe(true);
    expect(canActivateSilentPanic("CAMPUS_SUPERVISOR_K12")).toBe(false);
    expect(canActivateSilentPanic("CAMPUS_FACULTY_K12")).toBe(false);
    expect(canOperateSilentPanic("CAMPUS_SUPERVISOR_K12")).toBe(true);
  });

  it("follows the console product, so higher-ed seats stay off", () => {
    expect(isSilentPanicCampus("CAMPUS_ADMIN_HIGHERED", "k12")).toBe(false);
    expect(isSilentPanicCampus("CAMPUS_ADMIN_K12", "higher_ed")).toBe(true);
    expect(isSilentPanicCampus("CAMPUS_SECURITY_K12", "k12")).toBe(true);
    expect(isSilentPanicCampus("CAMPUS_ADMIN", "k12")).toBe(true);
    expect(isSilentPanicCampus("CAMPUS_ADMIN", "higher_ed")).toBe(false);
  });

  it("marks a drill as a test and never a law-enforcement page", () => {
    const text = silentPanicIncidentDescription({
      mode: "drill",
      schoolName: "Camden High",
      buildingName: "Main",
      activatedByName: "Alex Rivera",
    });
    expect(text).toContain("DRILL");
    expect(text).toContain("Not a law-enforcement page");
    expect(text).toContain("Camden High");
    expect(text).toContain("Main");
    expect(text).toContain("Alex Rivera");
    expect(text).toContain("No siren");
  });

  it("records a live activation without calling it a drill", () => {
    const text = silentPanicIncidentDescription({
      mode: "live",
      schoolName: "Camden High",
      buildingName: "Gym",
      activatedByName: "Alex Rivera",
    });
    expect(text.startsWith("LIVE")).toBe(true);
    expect(text).not.toContain("DRILL");
    expect(text).toContain("No public announcement");
  });
});
