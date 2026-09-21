import { describe, expect, it } from "vitest";
import {
  ensureLiveCallerOverlayLayers,
  LIVE_CALLER_HIT_LAYER,
  LIVE_CALLER_PULSE_LAYER,
  LIVE_CALLER_SOURCE,
} from "./live-caller-overlay";

describe("live caller overlay map safety", () => {
  it("adds pulse, accuracy, trail, and hit layers", () => {
    const layers = new Map<string, { id: string; type: string }>();
    const sources = new Map<string, { type: string }>();
    const images = new Set<string>();
    const map = {
      hasImage: (id: string) => images.has(id),
      addImage: (id: string) => {
        images.add(id);
      },
      triggerRepaint: () => undefined,
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

    ensureLiveCallerOverlayLayers(map as unknown as import("maplibre-gl").Map);
    expect(sources.has(LIVE_CALLER_SOURCE)).toBe(true);
    expect(layers.get(LIVE_CALLER_PULSE_LAYER)?.type).toBe("symbol");
    expect(layers.get(LIVE_CALLER_HIT_LAYER)?.type).toBe("circle");

    ensureLiveCallerOverlayLayers(map as unknown as import("maplibre-gl").Map);
    expect(layers.size).toBe(6);
  });
});
