import { describe, expect, it } from "vitest";
import { alsScopedId } from "rapid-cortex-shared";
import { airportsToGeoJSON } from "@/lib/maps/us-airports";
import {
  discoverTrafficLayerIds,
  geofencesToGeoJSON,
  lngLatBoundsOfIncidents,
  lngLatBoundsOfPoints,
  overlayZonesEnabled,
  parseGeofenceListPayload,
} from "./runtime-overlays";
import { DEFAULT_LAYER_VISIBILITY } from "./map-types";

describe("parseGeofenceListPayload", () => {
  it("reads { geofences } from the location API envelope", () => {
    const items = parseGeofenceListPayload({
      geofences: [
        {
          zoneId: "north",
          geofenceId: alsScopedId("test-agency", "north"),
          polygon: [
            [-84.4, 33.7],
            [-84.3, 33.7],
            [-84.3, 33.8],
            [-84.4, 33.8],
            [-84.4, 33.7],
          ],
        },
      ],
    });
    expect(items).toHaveLength(1);
    expect(geofencesToGeoJSON(items).features[0]?.geometry.type).toBe("Polygon");
  });

  it("drops malformed rows", () => {
    expect(parseGeofenceListPayload({ geofences: [{ zoneId: "x", polygon: [[1]] }] })).toEqual([]);
  });
});

describe("lngLatBoundsOfIncidents", () => {
  it("returns null when no geocoded incidents exist", () => {
    expect(
      lngLatBoundsOfIncidents([{ id: "1", status: "active", severity: "low", type: "other", locationLabel: "x", createdAt: "" }]),
    ).toBeNull();
  });

  it("returns a center-only result for a single point", () => {
    const fit = lngLatBoundsOfIncidents([
      {
        id: "1",
        status: "active",
        severity: "high",
        type: "medical",
        locationLabel: "Atlanta",
        createdAt: "",
        latitude: 33.75,
        longitude: -84.39,
      },
    ]);
    expect(fit?.center).toEqual([-84.39, 33.75]);
    expect(fit?.bounds).toBeUndefined();
  });

  it("returns bounds covering every point", () => {
    const fit = lngLatBoundsOfPoints([
      { longitude: -84.4, latitude: 33.7 },
      { longitude: -84.2, latitude: 33.9 },
    ]);
    expect(fit?.bounds).toEqual([
      [-84.4, 33.7],
      [-84.2, 33.9],
    ]);
  });
});

describe("overlayZonesEnabled", () => {
  it("is true when any zone toggle is on", () => {
    expect(overlayZonesEnabled({ ...DEFAULT_LAYER_VISIBILITY, agencyZones: true })).toBe(true);
    expect(
      overlayZonesEnabled({
        ...DEFAULT_LAYER_VISIBILITY,
        agencyZones: false,
        campusZones: true,
      }),
    ).toBe(true);
    expect(
      overlayZonesEnabled({
        ...DEFAULT_LAYER_VISIBILITY,
        agencyZones: false,
        campusZones: false,
        venueZones: false,
      }),
    ).toBe(false);
  });
});

describe("discoverTrafficLayerIds", () => {
  it("classifies HERE-style traffic layer ids", () => {
    const found = discoverTrafficLayerIds([
      { id: "traffic-flow" },
      { id: "traffic-closures" },
      { id: "roads" },
    ]);
    expect(found.flow).toEqual(["traffic-flow"]);
    expect(found.closures).toEqual(["traffic-closures"]);
  });
});

describe("airportsToGeoJSON", () => {
  it("dedupes IATA codes and keeps ATL", () => {
    const fc = airportsToGeoJSON();
    const iatas = fc.features.map((f) => String(f.properties?.iata));
    expect(new Set(iatas).size).toBe(iatas.length);
    expect(iatas).toContain("ATL");
  });
});
