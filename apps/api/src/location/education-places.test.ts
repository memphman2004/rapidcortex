import { describe, expect, it } from "vitest";
import { searchNearbyEducation } from "./education-places.js";

describe("searchNearbyEducation (mock)", () => {
  it("returns Columbus schools as GeoJSON near downtown", async () => {
    const fc = await searchNearbyEducation({
      centerLat: 32.46,
      centerLng: -84.98,
      west: -85.1,
      south: 32.3,
      east: -84.8,
      north: 32.6,
    });
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features.length).toBeGreaterThanOrEqual(3);
    expect(fc.features.some((f) => f.properties.name.includes("Columbus State"))).toBe(true);
    expect(fc.features.some((f) => f.properties.educationType === "secondary_school")).toBe(true);
    expect(fc.features.some((f) => f.properties.educationType === "primary_school")).toBe(true);
    expect(fc.features.every((f) => f.geometry.type === "Point")).toBe(true);
  });

  it("does not include Atlanta campuses when querying Columbus", async () => {
    const fc = await searchNearbyEducation({
      centerLat: 32.46,
      centerLng: -84.98,
      radiusMeters: 20_000,
    });
    expect(fc.features.some((f) => f.properties.name.includes("Emory"))).toBe(false);
  });
});
