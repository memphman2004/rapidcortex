import { describe, expect, it } from "vitest";
import {
  campusBuildingCodeFromLabel,
  campusBuildingSummariesFromQrCodes,
  isCampusDemoFixtureBuildingCode,
  overlayCampusBuildingIncidents,
} from "./campus-buildings-from-qr.js";

describe("campusBuildingCodeFromLabel", () => {
  it("slugs Field report-code names", () => {
    expect(campusBuildingCodeFromLabel("Rapid Hall")).toBe("RAPID-HALL");
    expect(campusBuildingCodeFromLabel("Wabash Hall ")).toBe("WABASH-HALL");
    expect(campusBuildingCodeFromLabel("Main campus reporting QR")).toBe("MAIN-CAMPUS");
  });
});

describe("campusBuildingSummariesFromQrCodes", () => {
  it("uses the same names as the QR Codes tab", () => {
    const rows = campusBuildingSummariesFromQrCodes([
      { qrId: "a", name: "Rapid Hall", zoneName: "Building 123, Floor 2" },
      { qrId: "b", name: "Wabash Hall ", zoneName: "Building C, Floor 3" },
      { qrId: "c", name: "Main campus reporting QR" },
    ]);
    expect(rows.map((r) => r.buildingName)).toEqual([
      "Rapid Hall",
      "Wabash Hall",
      "Main campus reporting QR",
    ]);
    expect(rows[0]?.zone).toBe("Building 123, Floor 2");
    expect(rows[2]?.zone).toBe("Unzoned");
    expect(isCampusDemoFixtureBuildingCode("MLC")).toBe(true);
    expect(isCampusDemoFixtureBuildingCode("RAPID-HALL")).toBe(false);
  });

  it("overlays incident counts from the buildings API when names match", () => {
    const merged = overlayCampusBuildingIncidents(
      campusBuildingSummariesFromQrCodes([{ qrId: "a", name: "Rapid Hall" }]),
      [
        {
          buildingId: "RAPID-HALL",
          buildingName: "Rapid Hall",
          zone: "x",
          occupancy: 12,
          status: "alert",
          activeIncidents: 2,
        },
      ],
    );
    expect(merged[0]?.activeIncidents).toBe(2);
    expect(merged[0]?.status).toBe("alert");
  });
});
