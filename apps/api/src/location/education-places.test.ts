import { describe, expect, it, vi } from "vitest";

vi.mock("./client.js", () => ({
  getGeoPlacesClient: () => ({
    send: async () => {
      throw new Error("Amazon Location unavailable");
    },
  }),
}));

import { searchNearbyEducation } from "./education-places.js";

describe("searchNearbyEducation", () => {
  it("soft-fails to an empty collection when Amazon Location is unavailable", async () => {
    const result = await searchNearbyEducation({
      centerLat: 32.46,
      centerLng: -84.98,
      west: -85.1,
      south: 32.3,
      east: -84.8,
      north: 32.6,
    });
    expect(result).toEqual({ type: "FeatureCollection", features: [] });
  });
});
