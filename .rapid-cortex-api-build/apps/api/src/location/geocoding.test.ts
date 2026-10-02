import { afterEach, describe, expect, it, vi } from "vitest";
import { alsScopedId } from "rapid-cortex-shared";
import { LocationNotConfiguredError } from "./client.js";
import { listAgencyGeofences } from "./geofence.js";
import { geocodeAddress, reverseGeocode } from "./geocoding.js";
import { calculateRoute } from "./routing.js";

describe("ALS location without a configured index", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not invent geocodes", async () => {
    vi.stubEnv("ALS_PLACE_INDEX_NAME", "");
    await expect(geocodeAddress("1600 Pennsylvania Ave NW, Washington DC")).resolves.toEqual([]);
    await expect(geocodeAddress("1125 Locust St Kansas City MO")).resolves.toEqual([]);
    await expect(reverseGeocode(-84.388, 33.749)).resolves.toEqual([]);
  });

  it("does not invent a route or a service-area geofence", async () => {
    vi.stubEnv("ALS_ROUTE_CALCULATOR_NAME", "");
    vi.stubEnv("ALS_GEOFENCE_COLLECTION_NAME", "");
    await expect(calculateRoute([-94.583, 39.1012], [-94.58, 39.11])).rejects.toBeInstanceOf(
      LocationNotConfiguredError,
    );
    await expect(listAgencyGeofences("test-agency")).resolves.toEqual([]);
  });

  it("scopes geofence ids without colons", () => {
    expect(alsScopedId("agency-uga", "building-myers-hall")).toBe("agency-uga--building-myers-hall");
  });
});
