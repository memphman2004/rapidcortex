import { describe, expect, it, vi } from "vitest";
import { listGisLayerIds, restoreGisOverlays, upsertGisOverlay } from "./gis-overlay";

function fakeMap() {
  const sources = new Map<string, unknown>();
  const layers = new Map<string, unknown>();
  return {
    getSource: (id: string) => sources.get(id),
    getLayer: (id: string) => layers.get(id),
    addSource: (id: string, src: unknown) => {
      sources.set(id, src);
    },
    removeSource: (id: string) => {
      sources.delete(id);
    },
    addLayer: (layer: { id: string }) => {
      layers.set(layer.id, layer);
    },
    removeLayer: (id: string) => {
      layers.delete(id);
    },
    _sources: sources,
    _layers: layers,
  };
}

describe("gis-overlay style-switch restore", () => {
  it("re-adds sources/layers after restore", () => {
    const map = fakeMap();
    const fc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "A" },
          geometry: { type: "Point", coordinates: [-83.37, 33.94] },
        },
      ],
    };
    upsertGisOverlay(map as never, {
      datasetId: "d1",
      name: "Test",
      featureCollection: fc,
    });
    expect(map.getSource("rc-gis-src-d1")).toBeTruthy();
    // Simulate setStyle wipe
    map._sources.clear();
    map._layers.clear();
    restoreGisOverlays(map as never, [
      { datasetId: "d1", name: "Test", featureCollection: fc },
    ]);
    expect(map.getSource("rc-gis-src-d1")).toBeTruthy();
    for (const id of listGisLayerIds("d1")) {
      expect(map.getLayer(id)).toBeTruthy();
    }
  });

  it("updates existing GeoJSON source data", () => {
    const setData = vi.fn();
    const map = {
      getSource: () => ({ setData }),
      getLayer: () => ({ id: "x" }),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      removeSource: vi.fn(),
    };
    const fc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
    upsertGisOverlay(map as never, {
      datasetId: "d2",
      name: "B",
      featureCollection: fc,
    });
    expect(setData).toHaveBeenCalledWith(fc);
  });
});
