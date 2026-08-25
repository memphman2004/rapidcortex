import { describe, expect, it } from "vitest";
import { stampColorIndex, stampColorIndexDynamic, stampColorIndexWithCountyFallback, lookupStateColorIndex } from "../apply-four-color";
import { buildAdjacencyFromGeoJSON, greedyColor } from "../graph-color";
import { normalizeUsStateKey, US_STATE_COLOR_INDEX } from "../us-state-colors";

describe("normalizeUsStateKey", () => {
  it("accepts abbrev and full name", () => {
    expect(normalizeUsStateKey("tx")).toBe("TX");
    expect(normalizeUsStateKey("Texas")).toBe("TX");
    expect(normalizeUsStateKey("")).toBeNull();
  });
});

describe("US_STATE_COLOR_INDEX", () => {
  it("keeps TX and OK on different colors", () => {
    expect(US_STATE_COLOR_INDEX.TX).not.toBe(US_STATE_COLOR_INDEX.OK);
  });
});

describe("greedyColor", () => {
  it("colors a simple path with adjacent difference", () => {
    const adjacency = new Map<string, Set<string>>([
      ["A", new Set(["B"])],
      ["B", new Set(["A", "C"])],
      ["C", new Set(["B"])],
    ]);
    const colors = greedyColor(adjacency);
    expect(colors.get("A")).not.toBe(colors.get("B"));
    expect(colors.get("B")).not.toBe(colors.get("C"));
  });
});

describe("stampColorIndex", () => {
  it("stamps precomputed indices from feature id", () => {
    const stamped = stampColorIndex(
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: "TX",
            properties: { name: "Texas" },
            geometry: { type: "Polygon", coordinates: [] },
          },
        ],
      },
      "id",
    );
    expect(stamped.features[0]?.properties?.rcColorIndex).toBe(US_STATE_COLOR_INDEX.TX);
  });
});

describe("stampColorIndexDynamic", () => {
  it("assigns from shared border coordinates", () => {
    const features: GeoJSON.Feature[] = [
      {
        type: "Feature",
        properties: { GEOID: "1" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
              [0, 0],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: { GEOID: "2" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [1, 0],
              [2, 0],
              [2, 1],
              [1, 1],
              [1, 0],
            ],
          ],
        },
      },
    ];
    const adjacency = buildAdjacencyFromGeoJSON(features, "GEOID");
    expect(adjacency.get("1")?.has("2")).toBe(true);
    const stamped = stampColorIndexDynamic(
      { type: "FeatureCollection", features },
      "GEOID",
    );
    expect(stamped.features[0]?.properties?.rcColorIndex).not.toBe(
      stamped.features[1]?.properties?.rcColorIndex,
    );
  });
});

describe("lookupStateColorIndex", () => {
  it("resolves abbrev and 2-digit FIPS, not county GEOID", () => {
    expect(lookupStateColorIndex("TX")).toBe(US_STATE_COLOR_INDEX.TX);
    expect(lookupStateColorIndex("48")).toBe(US_STATE_COLOR_INDEX.TX);
    expect(lookupStateColorIndex("48201")).toBeUndefined();
  });
});

describe("stampColorIndexWithCountyFallback", () => {
  it("keeps state table colors and adjacency-colors unknown GEOIDs", () => {
    const features: GeoJSON.Feature[] = [
      {
        type: "Feature",
        id: "TX",
        properties: { name: "Texas" },
        geometry: { type: "Polygon", coordinates: [] },
      },
      {
        type: "Feature",
        properties: { GEOID: "01001" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
              [0, 0],
            ],
          ],
        },
      },
      {
        type: "Feature",
        properties: { GEOID: "01003" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [1, 0],
              [2, 0],
              [2, 1],
              [1, 1],
              [1, 0],
            ],
          ],
        },
      },
    ];
    const stamped = stampColorIndexWithCountyFallback(
      { type: "FeatureCollection", features },
      "id",
    );
    const tx = stamped.features.find((f) => f.id === "TX");
    const c1 = stamped.features.find((f) => f.properties?.GEOID === "01001");
    const c2 = stamped.features.find((f) => f.properties?.GEOID === "01003");
    expect(tx?.properties?.rcColorIndex).toBe(US_STATE_COLOR_INDEX.TX);
    expect(c1?.properties?.rcColorIndex).not.toBe(c2?.properties?.rcColorIndex);
  });
});
