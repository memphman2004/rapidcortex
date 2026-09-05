import { describe, expect, it } from "vitest";
import type { VenueCamera } from "../venue/camera-registry-schemas.js";
import { rankCampusCamerasForPlace, scoreCampusCameraForPlace, selectCamerasForAreaScan } from "./place-cameras.js";

function cam(partial: Partial<VenueCamera> & Pick<VenueCamera, "cameraId" | "displayName">): VenueCamera {
  return {
    agencyId: "test-campus-iu",
    vendor: "onvif",
    kvsChannelName: `rc-test-campus-iu-${partial.cameraId}`,
    sections: [partial.buildingId ?? "BALLANTINE"],
    priorityRank: 10,
    ptzCapable: false,
    status: "online",
    ...partial,
  };
}

describe("rankCampusCamerasForPlace", () => {
  const building = cam({
    cameraId: "bldg",
    displayName: "Building lobby",
    buildingId: "BALLANTINE",
    priorityRank: 1,
  });
  const floor = cam({
    cameraId: "fl3",
    displayName: "Floor 3 hall",
    buildingId: "BALLANTINE",
    floor: "3",
    priorityRank: 2,
  });
  const zone = cam({
    cameraId: "zone",
    displayName: "Zone camera",
    buildingId: "BALLANTINE",
    floor: "3",
    zoneCode: "B-312",
    priorityRank: 5,
  });
  const qr = cam({
    cameraId: "qr",
    displayName: "Blue light / QR",
    buildingId: "BALLANTINE",
    floor: "3",
    zoneCode: "B-312",
    qrRcli: "IU-BL-12",
    assetKind: "blue_light",
    priorityRank: 9,
  });
  const otherBldg = cam({
    cameraId: "other",
    displayName: "Other building",
    buildingId: "KIRKWOOD",
    priorityRank: 1,
  });

  it("excludes cameras on a different building", () => {
    expect(scoreCampusCameraForPlace(otherBldg, { buildingId: "BALLANTINE" })).toBe(-1);
  });

  it("prefers QR, then zone, then floor over building-only", () => {
    const ranked = rankCampusCamerasForPlace(
      [building, floor, zone, qr, otherBldg],
      { buildingId: "BALLANTINE", floor: "3", zoneCode: "B-312", qrRcli: "IU-BL-12" },
      3,
    );
    expect(ranked.map((c) => c.cameraId)).toEqual(["qr", "zone", "fl3"]);
  });

  it("matches a QR-assigned camera even when the building metadata differs", () => {
    const assignedElsewhere = cam({
      cameraId: "qr-cross",
      displayName: "QR camera stored on another building",
      buildingId: "KIRKWOOD",
      qrRcli: "IU-BL-12",
      priorityRank: 9,
    });
    expect(scoreCampusCameraForPlace(assignedElsewhere, { buildingId: "BALLANTINE", qrRcli: "IU-BL-12" })).toBeGreaterThan(0);
    const ranked = rankCampusCamerasForPlace(
      [building, assignedElsewhere],
      { buildingId: "BALLANTINE", qrRcli: "IU-BL-12" },
      1,
    );
    expect(ranked.map((c) => c.cameraId)).toEqual(["qr-cross"]);
  });

  it("falls back to building cameras when zone/QR are unset", () => {
    const ranked = rankCampusCamerasForPlace([building, otherBldg], { buildingId: "BALLANTINE" }, 2);
    expect(ranked.map((c) => c.cameraId)).toEqual(["bldg"]);
  });

  it("selectCamerasForAreaScan prefers inprocessing cameraIds over ranking", () => {
    const selected = selectCamerasForAreaScan([building, floor, zone, qr], {
      assignedCameraIds: ["fl3"],
      place: { buildingId: "BALLANTINE", floor: "3", zoneCode: "B-312", qrRcli: "IU-BL-12" },
      limit: 2,
    });
    expect(selected.map((c) => c.cameraId)).toEqual(["fl3", "qr"]);
  });

  it("selectCamerasForAreaScan includes assigned cameras that fail building ranking", () => {
    const selected = selectCamerasForAreaScan([building, otherBldg], {
      assignedCameraIds: ["other"],
      place: { buildingId: "BALLANTINE" },
      limit: 2,
    });
    expect(selected.map((c) => c.cameraId)).toEqual(["other", "bldg"]);
  });
});
