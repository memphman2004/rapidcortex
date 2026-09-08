import { describe, expect, it } from "vitest";
import { mockNearbyIncidents, mockPremiseHazards } from "./mock-cad-context.js";

describe("mock CAD nearby / hazards", () => {
  it("returns a location-keyed nearby row when address text is present", () => {
    const rows = mockNearbyIncidents({ text: "4200 Oak Street" });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.cadIncidentId).toMatch(/mock-near-/);
  });

  it("flags officer-safety at known hazard addresses", () => {
    const hazards = mockPremiseHazards({ text: "4200 Oak Street" });
    expect(hazards.some((h) => h.officerSafety)).toBe(true);
    expect(mockPremiseHazards({ text: "" })).toEqual([]);
  });
});
