import { describe, expect, it } from "vitest";
import { inferCampusBuildingType, parseCampusQrZoneName } from "./campus-building-from-qr.js";

describe("parseCampusQrZoneName", () => {
  it("reads Field zone strings", () => {
    expect(parseCampusQrZoneName("Building 123, Floor 2")).toEqual({
      floor: 2,
      roomCode: "123",
      label: "Building 123, Floor 2",
    });
    expect(parseCampusQrZoneName("Building C, Floor 3")).toEqual({
      floor: 3,
      roomCode: "C",
      label: "Building C, Floor 3",
    });
  });
});

describe("inferCampusBuildingType", () => {
  it("treats halls as residential and campus-wide codes as outdoor", () => {
    expect(inferCampusBuildingType("Rapid Hall")).toBe("residential");
    expect(inferCampusBuildingType("Main campus reporting QR")).toBe("outdoor");
  });
});
