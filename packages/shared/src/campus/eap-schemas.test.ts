import { describe, expect, it } from "vitest";
import { matchCampusEap } from "./eap-schemas.js";

describe("matchCampusEap", () => {
  const buildingMedical = {
    buildingCode: "BALLANTINE",
    incidentTypes: ["medical"],
    active: true,
    title: "Ballantine medical EAP",
  };
  const campusMedical = {
    buildingCode: "*",
    incidentTypes: ["medical"],
    active: true,
    title: "Campus medical EAP",
  };
  const inactive = {
    buildingCode: "BALLANTINE",
    incidentTypes: ["medical"],
    active: false,
    title: "Retired",
  };

  it("prefers an exact building match over the campus wildcard", () => {
    expect(matchCampusEap([campusMedical, buildingMedical], "BALLANTINE", "medical")?.title).toBe(
      "Ballantine medical EAP",
    );
  });

  it("falls back to wildcard when no building-specific pack exists", () => {
    expect(matchCampusEap([campusMedical, inactive], "KIRKWOOD", "medical")?.title).toBe(
      "Campus medical EAP",
    );
  });

  it("returns null when type does not match", () => {
    expect(matchCampusEap([buildingMedical], "BALLANTINE", "active_threat")).toBeNull();
  });
});
