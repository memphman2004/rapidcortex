import { describe, expect, it } from "vitest";
import { isPsapMapFeatureCollection, psapPinsToGeoJSON } from "./geojson.js";

describe("psapPinsToGeoJSON", () => {
  it("emits GeoJSON [longitude, latitude] and public properties only", () => {
    const fc = psapPinsToGeoJSON([
      {
        psapId: "psap-001",
        psapName: "Muscogee County 911",
        lat: 32.4609,
        lon: -84.9877,
        state: "GA",
        city: "Columbus",
        county: "Muscogee",
        phone: "706-555-0911",
      },
    ]);
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]?.geometry.coordinates).toEqual([-84.9877, 32.4609]);
    expect(fc.features[0]?.properties).toEqual({
      id: "psap-001",
      name: "Muscogee County 911",
      city: "Columbus",
      state: "GA",
      county: "Muscogee",
      phone: "706-555-0911",
      cadVendor: "",
      psapType: "",
    });
    expect(JSON.stringify(fc)).not.toMatch(/email|outreach|notes|estimatedValue/i);
  });

  it("drops pins without coordinates", () => {
    const fc = psapPinsToGeoJSON([
      { psapId: "bad", psapName: "X", lat: Number.NaN, lon: -84, state: "GA" },
    ]);
    expect(fc.features).toHaveLength(0);
  });

  it("narrows FeatureCollection payloads", () => {
    expect(isPsapMapFeatureCollection({ type: "FeatureCollection", features: [] })).toBe(true);
    expect(isPsapMapFeatureCollection({ pins: [] })).toBe(false);
  });
});
