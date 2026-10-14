import { describe, expect, it } from "vitest";
import {
  createQRNFCSchema,
  safetyPointGisImportCommitSchema,
  safetyPointGisImportPreviewSchema,
  safetyPointGisImportRowSchema,
  updateQRNFCSchema,
} from "./schemas.js";

describe("registered safety point location schemas", () => {
  it("accepts GPS registration fields as UNVERIFIED by default intent", () => {
    const parsed = createQRNFCSchema.parse({
      name: "Student Center East",
      vertical: "campus",
      reportType: "anonymous",
      latitude: 32.8407,
      longitude: -83.6324,
      coordinateSource: "DEVICE_GPS",
      horizontalAccuracyMeters: 8,
      buildingName: "Student Center",
      floor: "2",
      room: "East Hallway",
      verificationStatus: "UNVERIFIED",
    });
    expect(parsed.latitude).toBeCloseTo(32.8407);
    expect(parsed.coordinateSource).toBe("DEVICE_GPS");
  });

  it("rejects out-of-range coordinates", () => {
    expect(() =>
      createQRNFCSchema.parse({
        name: "Bad",
        vertical: "campus",
        reportType: "anonymous",
        latitude: 120,
        longitude: -83,
      }),
    ).toThrow();
  });

  it("supports markLocationVerified on update without requiring coordinates in the same patch", () => {
    const parsed = updateQRNFCSchema.parse({ markLocationVerified: true });
    expect(parsed.markLocationVerified).toBe(true);
  });

  it("validates GIS import rows", () => {
    const row = safetyPointGisImportRowSchema.parse({
      safetyPointId: "01HQRTEST",
      siteCode: "MAIN",
      buildingName: "Library",
      floor: "1",
      zone: "Lobby",
      latitude: "39.1653",
      longitude: "-86.5264",
    });
    expect(row.latitude).toBeCloseTo(39.1653);
    expect(row.longitude).toBeCloseTo(-86.5264);
  });

  it("requires confirmCommit for GIS commit and accepts preview without write", () => {
    const preview = safetyPointGisImportPreviewSchema.parse({
      agencyId: "agency-a",
      rows: [{ safetyPointId: "01H", latitude: 1, longitude: 2 }],
    });
    expect(preview.rows).toHaveLength(1);
    expect(() =>
      safetyPointGisImportCommitSchema.parse({
        agencyId: "agency-a",
        rows: [{ safetyPointId: "01H", latitude: 1, longitude: 2 }],
      }),
    ).toThrow();
    const commit = safetyPointGisImportCommitSchema.parse({
      agencyId: "agency-a",
      confirmCommit: true,
      rows: [{ safetyPointId: "01H", latitude: 1, longitude: 2 }],
    });
    expect(commit.confirmCommit).toBe(true);
  });
});
