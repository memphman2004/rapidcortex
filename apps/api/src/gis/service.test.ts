import { beforeEach, describe, expect, it, vi } from "vitest";

const putMock = vi.fn();
const getMock = vi.fn();
const listMock = vi.fn();
const updateMock = vi.fn();
const putS3 = vi.fn();
const getS3 = vi.fn();
const presign = vi.fn();

vi.mock("./repository.js", () => ({
  GisDatasetsRepository: class {
    put = putMock;
    get = getMock;
    listByAgency = listMock;
    updateApproval = updateMock;
  },
}));

vi.mock("./storage.js", () => ({
  putNormalizedGeoJson: (...a: unknown[]) => putS3(...a),
  getNormalizedGeoJson: (...a: unknown[]) => getS3(...a),
  presignNormalizedGeoJson: (...a: unknown[]) => presign(...a),
}));

describe("GIS service (mock mode)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.GIS_MOCK = "1";
    putS3.mockResolvedValue("gis/a1/d1/normalized.geojson");
    presign.mockResolvedValue("https://example.com/presigned.geojson");
    listMock.mockResolvedValue([]);
  });

  it("discovers mock candidates without serviceUrl", async () => {
    const { discoverGis } = await import("./service.js");
    const out = await discoverGis(
      { userId: "u1", agencyId: "a1", role: "agencyadmin" } as never,
      { limit: 10 },
    );
    expect(out.candidates.length).toBeGreaterThan(0);
    expect(out.candidates[0]?.sourceType).toBe("mock");
  }, 30_000);

  it("imports mock GeoJSON and writes Dynamo + S3", async () => {
    const { importGisDataset } = await import("./service.js");
    const record = await importGisDataset(
      { userId: "u1", agencyId: "a1", role: "agencyadmin" } as never,
      {
        sourceUrl: "https://example.com/mock/FeatureServer/0",
        sourceType: "mock",
        maxFeatures: 100,
      },
    );
    expect(record.approvalStatus).toBe("imported");
    expect(record.validationStatus).toBe("unverified");
    expect(record.featureCount).toBe(2);
    expect(putS3).toHaveBeenCalled();
    expect(putMock).toHaveBeenCalled();
  });

  it("requires agencyId", async () => {
    const { importGisDataset } = await import("./service.js");
    await expect(
      importGisDataset(
        { userId: "u1", role: "agencyadmin" } as never,
        {
          sourceUrl: "https://example.com/mock/FeatureServer/0",
          sourceType: "mock",
        },
      ),
    ).rejects.toThrow("AGENCY_REQUIRED");
  });
});
