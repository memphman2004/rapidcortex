import { describe, expect, it } from "vitest";
import type { Incident } from "rapid-cortex-shared";
import { incidentsToGeoJSON } from "./map-utils";
import { psapIncidentsToMap, reportLocationToMapIncident } from "./map-incident-adapters";

function stubIncident(over: Partial<Incident> = {}): Incident {
  return {
    incidentId: "inc_robbery",
    agencyId: "test-agency",
    title: "Robbery",
    category: "police",
    urgency: "high",
    status: "active",
    source: "manual",
    confidence: null,
    escalationFlag: false,
    summary: "Armed robbery",
    createdAt: "2026-09-21T12:00:00.000Z",
    updatedAt: "2026-09-21T12:00:00.000Z",
    callerAddressLine: "497 Neely Rd, Sharpsburg, GA 30277",
    callerLocationLat: 33.3475,
    callerLocationLng: -84.6512,
    ...over,
  };
}

describe("psapIncidentsToMap", () => {
  it("keeps caller geocode on the map incident", () => {
    const [mapped] = psapIncidentsToMap([stubIncident()]);
    expect(mapped?.latitude).toBe(33.3475);
    expect(mapped?.longitude).toBe(-84.6512);
    expect(mapped?.status).toBe("active");
    expect(mapped?.severity).toBe("high");
  });

  it("defaults open incidents without urgency to high so they render as red", () => {
    const [mapped] = psapIncidentsToMap([
      stubIncident({ urgency: undefined as unknown as Incident["urgency"] }),
    ]);
    expect(mapped?.severity).toBe("high");
  });
});

describe("reportLocationToMapIncident", () => {
  it("builds an active map feature from a CAD pin", () => {
    const pin = reportLocationToMapIncident({
      id: "inc_1",
      latitude: 33.35,
      longitude: -84.65,
      locationLabel: "497 Neely Rd",
    });
    expect(pin.status).toBe("active");
    expect(pin.severity).toBe("high");
    const geo = incidentsToGeoJSON([pin]);
    expect(geo.features).toHaveLength(1);
    expect(geo.features[0]?.geometry).toEqual({
      type: "Point",
      coordinates: [-84.65, 33.35],
    });
  });
});
