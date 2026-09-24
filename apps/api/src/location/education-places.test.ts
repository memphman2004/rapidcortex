import { describe, expect, it, vi } from "vitest";

vi.mock("./client.js", () => ({
  getGeoPlacesClient: () => ({
    send: async () => {
      throw new Error("Amazon Location unavailable");
    },
  }),
}));

import { EducationPlacesUnavailableError, searchNearbyEducation } from "./education-places.js";

describe("searchNearbyEducation", () => {
  it("fails closed when Amazon Location is unavailable", async () => {
    await expect(
      searchNearbyEducation({
        centerLat: 32.46,
        centerLng: -84.98,
        west: -85.1,
        south: 32.3,
        east: -84.8,
        north: 32.6,
      }),
    ).rejects.toBeInstanceOf(EducationPlacesUnavailableError);
  });
});
