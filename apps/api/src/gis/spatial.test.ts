import { describe, expect, it } from "vitest";
import { featureContainsPoint, findContainingFeatures } from "./spatial.js";

describe("GIS spatial point-in-polygon", () => {
  const poly: GeoJSON.Feature = {
    type: "Feature",
    properties: { name: "Building" },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-83.375, 33.948],
          [-83.374, 33.948],
          [-83.374, 33.949],
          [-83.375, 33.949],
          [-83.375, 33.948],
        ],
      ],
    },
  };

  it("contains interior point", () => {
    expect(featureContainsPoint(poly, -83.3745, 33.9485)).toBe(true);
  });

  it("rejects exterior point", () => {
    expect(featureContainsPoint(poly, -83.38, 33.95)).toBe(false);
  });

  it("finds containing features in collection", () => {
    const hits = findContainingFeatures(
      { type: "FeatureCollection", features: [poly] },
      -83.3745,
      33.9485,
    );
    expect(hits).toHaveLength(1);
  });
});
