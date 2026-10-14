import { describe, expect, it } from "vitest";
import { createQRNFCSchema, publicReportSubmitSchema } from "./schemas.js";

describe("createQRNFCSchema", () => {
  it("accepts 10-digit US call numbers and normalizes to E.164", () => {
    const parsed = createQRNFCSchema.parse({
      name: "downtown",
      vertical: "911",
      reportType: "anonymous",
      callNumber: "8085428061",
    });
    expect(parsed.callNumber).toBe("+18085428061");
  });

  it("accepts camera assignment fields used during campus inprocessing", () => {
    const parsed = createQRNFCSchema.parse({
      name: "Ballantine 3rd floor QR",
      vertical: "campus",
      reportType: "anonymous",
      buildingId: "BALLANTINE",
      floor: "3",
      cameraIds: ["cam-ballantine-3"],
      siteCode: "BLOOMINGTON",
    });
    expect(parsed.buildingId).toBe("BALLANTINE");
    expect(parsed.floor).toBe("3");
    expect(parsed.cameraIds).toEqual(["cam-ballantine-3"]);
    expect(parsed.siteCode).toBe("BLOOMINGTON");
  });

  it("accepts transit vehicle / station / route camera place fields", () => {
    const parsed = createQRNFCSchema.parse({
      name: "Central platform QR",
      vertical: "transit",
      reportType: "anonymous",
      vehicleId: "bus-14",
      stationId: "central",
      routeId: "line-2",
      cameraIds: ["cam-central-plat"],
    });
    expect(parsed.vehicleId).toBe("bus-14");
    expect(parsed.stationId).toBe("central");
    expect(parsed.routeId).toBe("line-2");
    expect(parsed.cameraIds).toEqual(["cam-central-plat"]);
  });
});

describe("publicReportSubmitSchema", () => {
  it("accepts shareLiveLocation with callback phone", () => {
    const parsed = publicReportSubmitSchema.parse({
      qrId: "01HQRTEST0000000000000000",
      message: "Need help near the library",
      medium: "qr",
      reporterPhone: "+15551234567",
      shareLiveLocation: true,
    });
    expect(parsed.shareLiveLocation).toBe(true);
    expect(parsed.reporterPhone).toBe("+15551234567");
  });
});
