import { describe, expect, it } from "vitest";
import { mergeCampusMapPolygons } from "./campus-map-config";
import { campusCameraMapMarkers } from "./campus-camera-map-markers";
import type { VenueCamera } from "rapid-cortex-shared";

describe("mergeCampusMapPolygons", () => {
  it("appends overlay polygons onto OSM buildings", () => {
    const buildings: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { label: "Library" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 0],
              ],
            ],
          },
        },
      ],
    };
    const overlay: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "Zone A" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [2, 2],
                [3, 2],
                [3, 3],
                [2, 2],
              ],
            ],
          },
        },
        {
          type: "Feature",
          properties: { name: "Ignored point" },
          geometry: { type: "Point", coordinates: [-86.5, 39.17] },
        },
      ],
    };
    const merged = mergeCampusMapPolygons(buildings, overlay);
    expect(merged?.features).toHaveLength(2);
  });
});

describe("campusCameraMapMarkers", () => {
  it("uses explicit lat/lng when present", () => {
    const cameras = [
      {
        agencyId: "a1",
        cameraId: "cam-1",
        displayName: "Ballantine 1",
        vendor: "milestone",
        kvsChannelName: "rc-a1-cam-1",
        sections: ["BALLANTINE"],
        buildingId: "BALLANTINE",
        latitude: 39.17,
        longitude: -86.52,
        priorityRank: 1,
        ptzCapable: false,
        status: "online",
      },
    ] as VenueCamera[];
    const markers = campusCameraMapMarkers(cameras, null);
    expect(markers).toEqual([
      expect.objectContaining({ id: "cam-cam-1", type: "camera", lat: 39.17, lng: -86.52 }),
    ]);
  });
});
