import { describe, expect, it } from "vitest";
import { buildDemoVenueSectionGeoJSON } from "./demo-section-geojson";
import { resolveVenueOperationalMap } from "./resolve-operational-map";
import { buildVenueMapConfig } from "./venue-map-config";

describe("venue map config", () => {
  it("selects Mapbox 3D for demo catalogs and never leaves geojsonBase on a CDN host", () => {
    const config = buildVenueMapConfig(resolveVenueOperationalMap("MBS"));
    expect(config.renderer).toBe("mapbox3d");
    expect(config.pitch).toBe(55);
    expect(config.bearing).toBe(335);
    expect(config.geojsonBase).toBe("/api/venue/code/MBS/map");
    expect(config.isDemo).toBe(true);
  });

  it("keeps SVG fallback available via renderer field for non-geometry venues", () => {
    const map = resolveVenueOperationalMap("MBS");
    const svg = buildVenueMapConfig({ ...map, isDemo: false, zones: [] });
    expect(svg.renderer).toBe("svg");
  });
});

describe("demo section GeoJSON", () => {
  it("emits closed WGS84 polygons around the venue centroid", () => {
    const map = resolveVenueOperationalMap("MBS");
    const geo = buildDemoVenueSectionGeoJSON(map);
    expect(geo.features.length).toBeGreaterThan(8);
    const field = geo.features.find((f) => f.properties?.sectionId === "field");
    expect(field).toBeTruthy();
    const ring = field!.geometry.coordinates[0]!;
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    for (const [lng, lat] of ring) {
      expect(lng).toBeGreaterThan(-84.41);
      expect(lng).toBeLessThan(-84.39);
      expect(lat).toBeGreaterThan(33.75);
      expect(lat).toBeLessThan(33.76);
    }
    const incident = geo.features.find((f) => f.properties?.sectionId === "section-124");
    expect(incident?.properties?.status).toBe("incident");
    expect(incident?.properties?.extrusionHeight).toBeGreaterThan(0);
  });

  it("filters by level when requested", () => {
    const map = resolveVenueOperationalMap("MBS");
    const level2 = buildDemoVenueSectionGeoJSON(map, "level-2");
    expect(level2.features.every((f) => f.properties?.level === "level-2")).toBe(true);
    expect(level2.features.length).toBeGreaterThan(0);
  });
});
