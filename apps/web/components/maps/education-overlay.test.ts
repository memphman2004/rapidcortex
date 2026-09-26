import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EDUCATION_ICON_ID,
  EDUCATION_OVERLAY_LAYER_IDS,
  EDUCATION_POINTS,
  EDUCATION_SOURCE_ID,
  educationHoverContent,
  educationPropsFromFeature,
  educationViewportCacheKey,
  ensureEducationOverlayLayers,
  isEducationFetchInBackoff,
  loadEducationOverlay,
  shouldFetchEducationLayer,
} from "./education-overlay";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("education overlay zoom gate", () => {
  it("does not query below the minimum zoom", () => {
    expect(shouldFetchEducationLayer(7.99)).toBe(false);
    expect(shouldFetchEducationLayer(8)).toBe(true);
    expect(shouldFetchEducationLayer(12)).toBe(true);
  });
});

describe("education overlay error backoff", () => {
  it("skips retries until the backoff window expires", () => {
    expect(isEducationFetchInBackoff(0, 1_000)).toBe(false);
    expect(isEducationFetchInBackoff(5_000, 4_999)).toBe(true);
    expect(isEducationFetchInBackoff(5_000, 5_000)).toBe(false);
  });
});

describe("education overlay helpers", () => {
  it("builds hover content with name, type, address, and distance", () => {
    const content = educationHoverContent({
      id: "place-csu",
      name: "Columbus State University",
      educationType: "higher_education",
      educationLabel: "Higher Education",
      address: "4225 University Ave, Columbus, GA",
      city: "Columbus",
      state: "GA",
      phone: "",
      website: "",
      distanceMeters: 1850,
      distance: "1.8 mi",
    });
    expect(content.title).toBe("COLUMBUS STATE UNIVERSITY");
    expect(content.type).toBe("Higher Education");
    expect(content.addressLines[0]).toBe("4225 University Ave, Columbus, GA");
    expect(content.distance).toBe("1.8 mi away");
  });

  it("omits undefined rows", () => {
    const content = educationHoverContent({
      id: "x",
      name: "Northside High School",
      educationType: "secondary_school",
      educationLabel: "Secondary School",
      address: "",
      city: "",
      state: "",
      phone: "",
      website: "",
      distanceMeters: null,
      distance: "",
    });
    expect(content.addressLines).toEqual([]);
    expect(content.distance).toBe("");
  });

  it("builds a stable viewport cache key", () => {
    const a = educationViewportCacheKey({
      west: -85.1234,
      south: 32.3011,
      east: -84.8011,
      north: 32.6094,
      zoom: 11.4,
    });
    const b = educationViewportCacheKey({
      west: -85.1230,
      south: 32.3014,
      east: -84.8014,
      north: 32.6091,
      zoom: 11.9,
    });
    expect(a).toBe(b);
  });

  it("reads clustered feature properties without inventing values", () => {
    const props = educationPropsFromFeature({
      id: "p1",
      name: "Northside High School",
      educationType: "secondary_school",
      educationLabel: "Secondary School",
      address: "2002 American Way",
      city: "Columbus",
      state: "GA",
      distance: "3.2 mi",
      distanceMeters: "5149",
    });
    expect(props.educationType).toBe("secondary_school");
    expect(props.distanceMeters).toBe(5149);
    expect(props.phone).toBe("");
  });
});

describe("education overlay map safety", () => {
  it("does not crash when the education icon is missing", async () => {
    const layers = new Map<string, { id: string; type: string }>();
    const sources = new Map<string, { type: string }>();
    const map = {
      hasImage: () => false,
      loadImage: async () => {
        throw new Error("missing icon");
      },
      addImage: () => undefined,
      getSource: (id: string) => sources.get(id),
      addSource: (id: string, source: { type: string }) => {
        sources.set(id, source);
      },
      getLayer: (id: string) => layers.get(id),
      addLayer: (layer: { id: string; type: string }) => {
        layers.set(layer.id, layer);
      },
      getStyle: () => ({ layers: [] }),
    };
    await expect(
      ensureEducationOverlayLayers(map as unknown as import("maplibre-gl").Map),
    ).resolves.toBeUndefined();
    expect(sources.has(EDUCATION_SOURCE_ID)).toBe(true);
    expect(layers.get(EDUCATION_POINTS)?.type).toBe("circle");
    expect(layers.has(EDUCATION_OVERLAY_LAYER_IDS[0])).toBe(true);
    expect(EDUCATION_ICON_ID).toBe("education-icon");
    await expect(
      ensureEducationOverlayLayers(map as unknown as import("maplibre-gl").Map),
    ).resolves.toBeUndefined();
    expect(layers.size).toBe(3);
  });

  it("does not throw when SearchNearby fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Places V2 down");
      }),
    );
    const result = await loadEducationOverlay({
      centerLat: 32.46,
      centerLng: -84.98,
      west: -85.1,
      south: 32.3,
      east: -84.8,
      north: 32.6,
      zoom: 11,
    });
    expect(result).toEqual({ ok: false, aborted: false });
  });
});
