import { describe, expect, it } from "vitest";
import {
  getIncidentTypes,
  getIncidentTypeLabel,
  normalizeK12IncidentType,
  K12_INCIDENT_TYPES,
} from "./incident-types.js";

describe("K-12 incident types", () => {
  it("includes the core concern categories for school safety reporting", () => {
    const values = new Set(K12_INCIDENT_TYPES.map((t) => t.value));
    expect(values.has("active_threat")).toBe(true);
    expect(values.has("bullying")).toBe(true);
    expect(values.has("self_harm")).toBe(true);
    expect(values.has("custody_pickup")).toBe(true);
    expect(values.has("facility_hazard")).toBe(true);
    expect(values.has("other")).toBe(true);
    expect(K12_INCIDENT_TYPES.length).toBeGreaterThanOrEqual(40);
  });

  it("normalizes legacy codes onto the expanded catalog", () => {
    expect(normalizeK12IncidentType("weapon")).toBe("weapon_concern");
    expect(normalizeK12IncidentType("welfare_check")).toBe("student_welfare");
    expect(normalizeK12IncidentType("lockdown_threat")).toBe("active_threat");
    expect(normalizeK12IncidentType("facility_hazard")).toBe("facility_hazard");
  });

  it("returns K-12 labels via getIncidentTypes", () => {
    expect(getIncidentTypes("k12")[0]?.label).toContain("Active Threat");
    expect(getIncidentTypeLabel("k12", "fight")).toBe("Fight / Physical Altercation");
    expect(getIncidentTypeLabel("higher_ed", "assault")).toBe("Assault");
  });
});
