import { describe, expect, it } from "vitest";
import { incidentCoordinates, type RCIncident } from "./require-active-incident.js";

function baseIncident(overrides: Partial<RCIncident> = {}): RCIncident {
  return {
    incidentId: "inc-1",
    agencyId: "agency-1",
    status: "active",
    ...overrides,
  };
}

describe("incidentCoordinates", () => {
  it("prefers canonical callerLocationLat/Lng", () => {
    expect(
      incidentCoordinates(
        baseIncident({
          callerLocationLat: 38.9,
          callerLocationLng: -77.0,
          latitude: 1,
          longitude: 2,
          location: { latitude: 3, longitude: 4, lat: 5, lng: 6 },
        }),
      ),
    ).toEqual({ latitude: 38.9, longitude: -77.0 });
  });

  it("falls back to flat latitude/longitude", () => {
    expect(incidentCoordinates(baseIncident({ latitude: 40.7, longitude: -74.0 }))).toEqual({
      latitude: 40.7,
      longitude: -74.0,
    });
  });

  it("falls back to nested location.latitude/longitude", () => {
    expect(
      incidentCoordinates(baseIncident({ location: { latitude: 33.7, longitude: -84.4 } })),
    ).toEqual({ latitude: 33.7, longitude: -84.4 });
  });

  it("falls back to legacy location.lat/lng", () => {
    expect(incidentCoordinates(baseIncident({ location: { lat: 29.7, lng: -95.3 } }))).toEqual({
      latitude: 29.7,
      longitude: -95.3,
    });
  });

  it("throws when no coordinates are present", () => {
    expect(() => incidentCoordinates(baseIncident())).toThrow(/missing valid latitude/);
  });
});
