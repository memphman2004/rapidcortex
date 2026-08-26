import { describe, expect, it } from "vitest";
import { MBS_DEMO_OPERATIONAL_MAP } from "./mbs-demo-map";
import {
  assetTypeToFacilityLayer,
  buildExteriorOverlays,
  entranceKindToExteriorLayer,
} from "./layers";

describe("operational awareness layers", () => {
  it("maps asset types onto facility layers", () => {
    expect(assetTypeToFacilityLayer("camera")).toBe("cameras");
    expect(assetTypeToFacilityLayer("aed")).toBe("medical");
    expect(assetTypeToFacilityLayer("qrZone")).toBe("qrZones");
    expect(entranceKindToExteriorLayer("emergency")).toBe("staging");
    expect(entranceKindToExteriorLayer("public")).toBe("entrances");
  });

  it("only emits configured exterior overlays", () => {
    const all = buildExteriorOverlays(MBS_DEMO_OPERATIONAL_MAP, new Set(["cameras", "entrances", "staging"]));
    expect(all.some((item) => item.id === "CAM-EXT-N")).toBe(true);
    expect(all.some((item) => item.id === "GATE-04")).toBe(true);
    expect(all.some((item) => item.id === "EMS-STAGING")).toBe(true);

    const camerasOnly = buildExteriorOverlays(MBS_DEMO_OPERATIONAL_MAP, new Set(["cameras"]));
    expect(camerasOnly.every((item) => item.kind === "camera")).toBe(true);
  });
});
