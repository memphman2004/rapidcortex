import { describe, expect, it } from "vitest";
import type { CampusBuildingSummary } from "rapid-cortex-shared";
import { buildCampusMapConfig, mapCampusBuildingStatus, mergeCampusBuildingStatus } from "./campus-map-config";
import { resolveCampusOsmConfig } from "./campus-osm-registry";
import {
  campusOsmToBuildingGeoJSON,
  extractCampusOsmMarkers,
  summarizeCampusOsm,
  type OverpassResponse,
} from "./overpass-to-campus-geojson";

const CSU = resolveCampusOsmConfig("csu")!;

const SAMPLE_OSM: OverpassResponse = {
  elements: [
    {
      type: "way",
      id: 1,
      tags: { building: "university", name: "Schwob Memorial Library", "building:levels": "4" },
      geometry: [
        { lat: 32.474, lon: -84.991 },
        { lat: 32.474, lon: -84.99 },
        { lat: 32.4735, lon: -84.99 },
        { lat: 32.4735, lon: -84.991 },
        { lat: 32.474, lon: -84.991 },
      ],
    },
    {
      type: "node",
      id: 2,
      lat: 32.4742,
      lon: -84.9905,
      tags: { amenity: "defibrillator", name: "Library AED" },
    },
    {
      type: "node",
      id: 3,
      lat: 32.4738,
      lon: -84.9898,
      tags: { emergency: "phone" },
    },
  ],
};

describe("campus OSM registry", () => {
  it("resolves CSU aliases and UGA", () => {
    expect(resolveCampusOsmConfig("test-campus-csu")?.campusId).toBe("CSU");
    expect(resolveCampusOsmConfig("CSU")?.center[0]).toBeCloseTo(-84.99, 2);
    expect(resolveCampusOsmConfig("UGA")?.campusName).toContain("Georgia");
    expect(resolveCampusOsmConfig("LINCOLNHIGH")).toBeNull();
  });
});

describe("campus map config", () => {
  it("selects Mapbox 3D for registered campuses and never uses a CDN host", () => {
    const config = buildCampusMapConfig("CSU");
    expect(config.mapType).toBe("campus");
    expect(config.renderer).toBe("mapbox3d");
    expect(config.pitch).toBe(45);
    expect(config.geojsonBase).toBe("/api/campus/code/CSU/map");
    expect(config.hasOsmCoverage).toBe(true);
  });

  it("falls back to 2D without OSM coverage instead of 404", () => {
    const config = buildCampusMapConfig("LINCOLNHIGH");
    expect(config.renderer).toBe("mapbox2d");
    expect(config.hasOsmCoverage).toBe(false);
  });
});

describe("Overpass to campus GeoJSON", () => {
  it("builds closed polygons with extrusion height from floor count", () => {
    const geo = campusOsmToBuildingGeoJSON(SAMPLE_OSM, CSU);
    expect(geo.features).toHaveLength(1);
    const feature = geo.features[0]!;
    expect(feature.properties?.label).toBe("Schwob Memorial Library");
    expect(feature.properties?.extrusionHeight).toBe(16);
    expect(feature.properties?.buildingType).toBe("academic");
    const ring = feature.geometry.coordinates[0]!;
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(summarizeCampusOsm(SAMPLE_OSM)).toEqual({
      buildings: 1,
      named: 1,
      withLevels: 1,
      aeds: 1,
      phones: 1,
    });
    const markers = extractCampusOsmMarkers(SAMPLE_OSM);
    expect(markers.map((m) => m.type).sort()).toEqual(["aed", "emergencyPhone"]);
  });

  it("merges live building status onto OSM labels", () => {
    const geo = campusOsmToBuildingGeoJSON(SAMPLE_OSM, CSU);
    const buildings: CampusBuildingSummary[] = [
      {
        buildingId: "lib-1",
        buildingName: "Schwob Memorial Library",
        zone: "Academic",
        occupancy: null,
        status: "alert",
        activeIncidents: 2,
      },
    ];
    const merged = mergeCampusBuildingStatus(geo, buildings);
    expect(merged.features[0]?.properties?.status).toBe("incident");
    expect(mapCampusBuildingStatus({ status: "nominal", activeIncidents: 0 })).toBe("clear");
    expect(mapCampusBuildingStatus({ status: "closed", activeIncidents: 0 })).toBe("closed");
  });
});
