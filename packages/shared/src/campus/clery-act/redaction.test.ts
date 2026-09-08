import { describe, expect, it } from "vitest";
import { filterPublicCrimeLogEntries, runVictimSafetyRedactionCheck } from "./redaction.js";

describe("VictimSafetyRedactionCheck", () => {
  it("allows a general building description", () => {
    const result = runVictimSafetyRedactionCheck("Myers Hall Residential", "RAPE");
    expect(result.ok).toBe(true);
    expect(result.blockedTerms).toEqual([]);
  });

  it("blocks room-level identifiers before they can enter the public log", () => {
    const result = runVictimSafetyRedactionCheck("Room 312, Myers Hall", "RAPE");
    expect(result.ok).toBe(false);
    expect(result.blockedTerms).toContain("room_number");
  });

  it("blocks apartment / unit identifiers", () => {
    expect(runVictimSafetyRedactionCheck("Apt 4B Oak Court", "BURGLARY").ok).toBe(false);
    expect(runVictimSafetyRedactionCheck("Unit 12 Science Annex", "BURGLARY").blockedTerms).toContain(
      "apt_number",
    );
  });

  it("blocks victim-identifying words and contact data", () => {
    expect(runVictimSafetyRedactionCheck("Victim's suite, North Quad", "FONDLING").ok).toBe(false);
    expect(runVictimSafetyRedactionCheck("Call 555-201-9999 at the hall desk", "BURGLARY").ok).toBe(
      false,
    );
  });

  it("rejects empty location", () => {
    expect(runVictimSafetyRedactionCheck("   ").ok).toBe(false);
  });

  it("strips unsafe locations from the public crime log even if they were stored", () => {
    const kept = filterPublicCrimeLogEntries([
      { generalLocation: "Myers Hall Residential", cleryOffenseCategory: "RAPE" as const },
      { generalLocation: "Room 312, Myers Hall", cleryOffenseCategory: "RAPE" as const },
    ]);
    expect(kept).toEqual([
      { generalLocation: "Myers Hall Residential", cleryOffenseCategory: "RAPE" },
    ]);
  });
});
