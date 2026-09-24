import { describe, expect, it, vi } from "vitest";

vi.mock("./client.js", () => ({
  getGeoPlacesClient: () => ({
    send: async () => {
      throw new Error("Amazon Location unavailable");
    },
  }),
}));

import { searchNearbyHospitals } from "./hospital-places.js";

describe("searchNearbyHospitals", () => {
  it("returns an empty collection when Amazon Location is unavailable", async () => {
    const fc = await searchNearbyHospitals({
      lat: 33.749,
      lng: -84.388,
      radius: 30_000,
      erOnly: false,
    });
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toEqual([]);
  });
});
