import { describe, expect, it } from "vitest";
import { transitPlaceFromQrRecord } from "./transit-place.js";

describe("transitPlaceFromQrRecord", () => {
  it("uses explicit vehicle / station / route fields", () => {
    expect(
      transitPlaceFromQrRecord({
        vehicleId: "bus-14",
        stationId: "central",
        routeId: "line-2",
        qrId: "QR1",
      }),
    ).toEqual({
      vehicleId: "bus-14",
      stationId: "central",
      routeId: "line-2",
      qrRcli: "QR1",
    });
  });

  it("falls back to buildingId / zoneId for older transit QR codes", () => {
    expect(
      transitPlaceFromQrRecord({
        buildingId: "train-7",
        zoneId: "union-station",
        qrId: "QR2",
      }),
    ).toEqual({
      vehicleId: "train-7",
      stationId: "union-station",
      qrRcli: "QR2",
    });
  });
});
