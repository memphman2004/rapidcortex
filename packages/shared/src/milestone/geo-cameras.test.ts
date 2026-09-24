import { describe, expect, it } from "vitest";
import type { VenueCamera } from "../venue/camera-registry-schemas.js";
import {
  clampMilestoneRadiusMeters,
  rankCamerasByGeoProximity,
  scoreCameraByGeoProximity,
  selectCamerasForAreaScanWithGeo,
} from "./geo-cameras.js";

function cam(partial: Partial<VenueCamera> & Pick<VenueCamera, "cameraId" | "displayName">): VenueCamera {
  return {
    agencyId: "a1",
    vendor: "milestone",
    kvsChannelName: `rc-a1-${partial.cameraId}`,
    sections: ["BALLANTINE"],
    buildingId: "BALLANTINE",
    priorityRank: 50,
    ptzCapable: false,
    status: "online",
    ...partial,
  };
}

describe("milestone geo cameras", () => {
  it("clamps radius to 50–500", () => {
    expect(clampMilestoneRadiusMeters(10)).toBe(50);
    expect(clampMilestoneRadiusMeters(150)).toBe(150);
    expect(clampMilestoneRadiusMeters(9999)).toBe(500);
  });

  it("scores by haversine and excludes outside radius", () => {
    const near = cam({
      cameraId: "near",
      displayName: "Near",
      latitude: 39.1653,
      longitude: -86.5264,
    });
    const far = cam({
      cameraId: "far",
      displayName: "Far",
      latitude: 40.0,
      longitude: -86.0,
    });
    const origin = { latitude: 39.1653, longitude: -86.5264 };
    expect(scoreCameraByGeoProximity(near, origin, 150)).toBeGreaterThan(0);
    expect(scoreCameraByGeoProximity(far, origin, 150)).toBe(-1);
  });

  it("merges place ranking with geo fill", () => {
    const qrMatch = cam({
      cameraId: "qr",
      displayName: "QR cam",
      qrRcli: "RCLI-1",
      latitude: 39.17,
      longitude: -86.53,
    });
    const geoOnly = cam({
      cameraId: "geo",
      displayName: "Geo cam",
      buildingId: "OTHER",
      sections: ["OTHER"],
      latitude: 39.16531,
      longitude: -86.52641,
    });
    const selected = selectCamerasForAreaScanWithGeo([qrMatch, geoOnly], {
      place: { buildingId: "BALLANTINE", qrRcli: "RCLI-1" },
      origin: { latitude: 39.1653, longitude: -86.5264 },
      radiusMeters: 150,
      limit: 4,
    });
    expect(selected.map((c) => c.cameraId)).toEqual(["qr", "geo"]);
  });

  it("ranks geo cameras by distance", () => {
    const a = cam({
      cameraId: "a",
      displayName: "A",
      latitude: 39.1654,
      longitude: -86.5264,
    });
    const b = cam({
      cameraId: "b",
      displayName: "B",
      latitude: 39.1659,
      longitude: -86.5264,
    });
    const ranked = rankCamerasByGeoProximity(
      [b, a],
      { latitude: 39.1653, longitude: -86.5264 },
      500,
      2,
    );
    expect(ranked[0]?.cameraId).toBe("a");
  });
});
