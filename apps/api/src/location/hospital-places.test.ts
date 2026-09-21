import { describe, expect, it } from "vitest";
import { searchNearbyHospitals } from "./hospital-places.js";

describe("searchNearbyHospitals (mock)", () => {
  it("returns Atlanta hospitals as GeoJSON near downtown", async () => {
    const fc = await searchNearbyHospitals({
      lat: 33.749,
      lng: -84.388,
      radius: 30_000,
      erOnly: false,
    });
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features.length).toBeGreaterThanOrEqual(3);
    expect(fc.features.some((f) => f.properties.name.includes("Grady"))).toBe(true);
    expect(fc.features.every((f) => f.geometry.type === "Point")).toBe(true);
  });

  it("returns Piedmont Columbus Regional near Columbus", async () => {
    const fc = await searchNearbyHospitals({
      lat: 32.46,
      lng: -84.99,
      radius: 30_000,
      fromLat: 32.46,
      fromLng: -84.99,
      erOnly: false,
    });
    const piedmont = fc.features.find((f) => f.properties.id === "mock-piedmont-columbus");
    expect(piedmont?.properties.name).toBe("Piedmont Columbus Regional");
    expect(piedmont?.properties.emergencyRoom).toBe(true);
    expect(piedmont?.properties.distance).toMatch(/mi/);
  });
});
