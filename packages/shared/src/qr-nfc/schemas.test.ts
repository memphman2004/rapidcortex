import { describe, expect, it } from "vitest";
import { createQRNFCSchema } from "./schemas.js";

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
});
