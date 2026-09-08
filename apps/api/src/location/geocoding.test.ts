import { describe, expect, it } from "vitest";
import { geocodeAddress, reverseGeocode } from "./geocoding.js";
import { calculateRoute } from "./routing.js";
import { alsScopedId } from "rapid-cortex-shared";

describe("ALS location mock", () => {
  it("geocodes the White House fixture", async () => {
    const results = await geocodeAddress("1600 Pennsylvania Ave NW, Washington DC");
    expect(results[0]?.formattedAddress).toMatch(/Pennsylvania/i);
    expect(results[0]?.latitude).toBeCloseTo(38.8977, 2);
    expect(results[0]?.provider).toBe("amazon-location");
  });

  it("geocodes a Kansas City agency address", async () => {
    const results = await geocodeAddress("1125 Locust St Kansas City MO");
    expect(results[0]?.city).toBe("Kansas City");
    expect(results[0]?.longitude).toBeCloseTo(-94.583, 1);
  });

  it("reverse geocodes with mock coordinates", async () => {
    const results = await reverseGeocode(-84.388, 33.749);
    expect(results[0]?.provider).toBe("amazon-location");
    expect(results[0]?.latitude).toBe(33.749);
  });

  it("returns a mock car route with geometry", async () => {
    const route = await calculateRoute([-94.583, 39.1012], [-94.58, 39.11]);
    expect(route.distanceMiles).toBeGreaterThan(0);
    expect(route.durationMinutes).toBeGreaterThan(0);
    expect(route.geometry.length).toBeGreaterThanOrEqual(2);
  });

  it("scopes geofence ids without colons", () => {
    expect(alsScopedId("agency-uga", "building-myers-hall")).toBe("agency-uga--building-myers-hall");
  });
});
