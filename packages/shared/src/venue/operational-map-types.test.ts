import { describe, expect, it } from "vitest";
import {
  EXTERIOR_LAYER_IDS,
  FACILITY_LAYER_IDS,
  OPERATIONAL_VIEW_MODES,
} from "./operational-map-types.js";

describe("operational map model", () => {
  it("defines split/area/facility view modes", () => {
    expect(OPERATIONAL_VIEW_MODES).toEqual(["split", "area", "facility"]);
  });

  it("lists facility and exterior layer ids", () => {
    expect(FACILITY_LAYER_IDS).toContain("incidents");
    expect(FACILITY_LAYER_IDS).toContain("qrZones");
    expect(EXTERIOR_LAYER_IDS).toContain("staging");
  });
});
