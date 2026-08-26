import { describe, expect, it } from "vitest";
import type { QRLocation } from "rapid-cortex-shared";
import {
  locationToVenueZone,
  mergeVenueZones,
  nextRcZoneCode,
  normalizeVenueZoneCode,
} from "./venue-zone-map";
import type { VenueZone } from "./venue-types";

describe("venue zone mapping", () => {
  it("suggests the next RC zone code after the highest existing RC number", () => {
    expect(nextRcZoneCode([])).toBe("RC101");
    expect(nextRcZoneCode(["S101", "G-A"])).toBe("RC101");
    expect(nextRcZoneCode(["RC101", "RC204", "rc110"])).toBe("RC205");
  });

  it("maps a QR location onto the zones table", () => {
    const location = {
      rcli: "RCLI-MBS-000012",
      agencyId: "agency-1",
      orgCode: "MBS",
      vertical: "venue",
      locationName: "Section 118",
      building: "Lower Bowl",
      zone: "S118",
      zoneCode: "RC118",
      active: true,
      scanCount: 0,
      createdBy: "user-1",
      createdAt: "2026-08-25T00:00:00.000Z",
    } satisfies QRLocation;

    expect(locationToVenueZone(location, "mbs")).toEqual({
      id: "RCLI-MBS-000012",
      venueCode: "MBS",
      code: "S118",
      label: "Section 118",
      level: "Lower Bowl",
      cameraIds: [],
      qrUrl: "/report/MBS/S118",
      activeIncidents: 0,
    });
  });

  it("keeps fixture rows whose codes are not already live", () => {
    const live: VenueZone[] = [
      {
        id: "live-1",
        venueCode: "MBS",
        code: "S101",
        label: "Section 101 live",
        level: "Lower Bowl",
        cameraIds: [],
        qrUrl: "/report/MBS/S101",
        activeIncidents: 0,
      },
    ];
    const fixtures: VenueZone[] = [
      { ...live[0]!, id: "fix-1", label: "Section 101 fixture" },
      {
        id: "fix-2",
        venueCode: "MBS",
        code: "G-A",
        label: "Gate A",
        level: "Perimeter",
        cameraIds: [],
        qrUrl: "/report/MBS/G-A",
        activeIncidents: 0,
      },
    ];
    const merged = mergeVenueZones(live, fixtures);
    expect(merged.map((z) => z.code)).toEqual(["S101", "G-A"]);
    expect(merged[0]?.label).toBe("Section 101 live");
  });

  it("normalizes zone codes", () => {
    expect(normalizeVenueZoneCode(" s 118 ")).toBe("S118");
    expect(normalizeVenueZoneCode("g-a")).toBe("G-A");
  });
});
