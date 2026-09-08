import { describe, expect, it } from "vitest";
import { addressConfidenceFromGeocode, assignCallAssistZone, jurisdictionHint } from "./gis.js";

describe("Call Assist GIS", () => {
  const downtown: Array<[number, number]> = [
    [-94.6, 39.08],
    [-94.55, 39.08],
    [-94.55, 39.12],
    [-94.6, 39.12],
    [-94.6, 39.08],
  ];

  it("assigns a zone when the point is inside the polygon", () => {
    const hit = assignCallAssistZone(-94.58, 39.1, [{ id: "z1", name: "Central", polygon: downtown }]);
    expect(hit).toEqual({ zoneId: "z1", zoneName: "Central" });
    expect(assignCallAssistZone(-90, 30, [{ id: "z1", name: "Central", polygon: downtown }])).toBeNull();
  });

  it("maps geocode relevance to address confidence", () => {
    expect(addressConfidenceFromGeocode({ geocodeConfidence: 0.91 })).toBeCloseTo(0.91);
    expect(addressConfidenceFromGeocode({ locationSource: "ANI_ALI" })).toBeGreaterThan(0.7);
    expect(addressConfidenceFromGeocode({ hasText: true })).toBeLessThan(0.5);
  });

  it("hints jurisdiction from city/state vs tenant", () => {
    expect(jurisdictionHint({ city: "Kansas City", state: "MO", tenantCity: "kansas city", tenantState: "mo" }).match).toBe(
      true,
    );
    expect(jurisdictionHint({ city: "Topeka", state: "KS", tenantCity: "kansas city", tenantState: "mo" }).match).toBe(
      false,
    );
  });
});
