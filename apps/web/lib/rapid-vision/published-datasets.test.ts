import { describe, expect, it } from "vitest";
import { PUBLISHED_DATASETS, publishedDatasetImport } from "./published-datasets";

describe("published dataset registry", () => {
  it("refuses every named set, including YouTube-derived fight clips", () => {
    for (const row of PUBLISHED_DATASETS) {
      expect(publishedDatasetImport(row.id).downloaded).toBe(false);
      expect(publishedDatasetImport(row.id).ok).toBe(false);
    }
    expect(publishedDatasetImport("rwf-2000").reason).toMatch(/YouTube/);
    expect(publishedDatasetImport("xd-violence").reason).toMatch(/YouTube/);
    expect(publishedDatasetImport("kinetics-700").reason).toMatch(/YouTube/);
    expect(publishedDatasetImport("ucf-crime").reason).toMatch(/not a license/);
    expect(publishedDatasetImport("coco").reason).toMatch(/does not include firearm/);
    expect(publishedDatasetImport("kitti").reason).toMatch(/non-commercial/);
    expect(publishedDatasetImport("roboflow-universe").reason).toMatch(/not downloaded/);
    expect(publishedDatasetImport("missing").reason).toMatch(/not in the registry/);
  });
});
