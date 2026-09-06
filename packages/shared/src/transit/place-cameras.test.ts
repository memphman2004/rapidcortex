import { describe, expect, it } from "vitest";
import type { VenueCamera } from "../venue/camera-registry-schemas.js";
import { scoreTransitCameraForPlace, selectCamerasForTransitPlace } from "./place-cameras.js";

function cam(partial: Partial<VenueCamera> & Pick<VenueCamera, "cameraId" | "displayName">): VenueCamera {
  return {
    agencyId: "test-transit-hvt",
    kvsChannelName: `rc-test-transit-hvt-${partial.cameraId}`,
    vendor: "onvif",
    sections: [partial.vehicleId ?? "bus-1"],
    priorityRank: 10,
    ptzCapable: false,
    status: "online",
    ...partial,
  };
}

describe("transit place cameras", () => {
  const onboard = cam({ cameraId: "onboard", displayName: "Bus 14 rear", vehicleId: "bus-14", priorityRank: 2 });
  const station = cam({
    cameraId: "plat",
    displayName: "Central platform",
    vehicleId: undefined,
    stationId: "central",
    sections: ["central"],
    priorityRank: 5,
  });
  const route = cam({
    cameraId: "route",
    displayName: "Line 2 overview",
    routeId: "line-2",
    sections: ["line-2"],
    priorityRank: 8,
  });
  const other = cam({ cameraId: "other", displayName: "Other bus", vehicleId: "bus-99" });

  it("prefers the matching vehicle camera over station and route", () => {
    expect(scoreTransitCameraForPlace(onboard, { vehicleId: "bus-14" })).toBeGreaterThan(
      scoreTransitCameraForPlace(station, { vehicleId: "bus-14", stationId: "central" }),
    );
  });

  it("excludes cameras that do not cover the vehicle, station, or route", () => {
    expect(scoreTransitCameraForPlace(other, { vehicleId: "bus-14" })).toBe(-1);
  });

  it("selectCamerasForTransitPlace prefers assigned vehicle cameraIds", () => {
    const selected = selectCamerasForTransitPlace([onboard, station, other], {
      assignedCameraIds: ["other"],
      place: { vehicleId: "bus-14" },
      limit: 1,
    });
    expect(selected.map((c) => c.cameraId)).toEqual(["other"]);
  });

  it("falls back to station cameras when vehicle has no match", () => {
    const selected = selectCamerasForTransitPlace([station, route, other], {
      place: { vehicleId: "bus-14", stationId: "central" },
      limit: 1,
    });
    expect(selected.map((c) => c.cameraId)).toEqual(["plat"]);
  });
});
