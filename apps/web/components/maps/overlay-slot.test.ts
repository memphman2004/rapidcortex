import { describe, expect, it, vi } from "vitest";
import { mapLayersStorageKey } from "@/lib/maps/persisted-map-prefs";
import { DEFAULT_LAYER_VISIBILITY } from "./map-types";
import { addOverlayLayer, OVERLAY_SLOT, withOverlaySlot } from "./overlay-slot";

describe("overlay slot", () => {
  it("pins custom layers to the Maps V2 top slot", () => {
    expect(withOverlaySlot({ id: "rc-overlay-counties-line", type: "line" }).slot).toBe(
      OVERLAY_SLOT,
    );
  });

  it("adds the slot when inserting a MapLibre layer", () => {
    const added: Array<{ id: string; slot?: string }> = [];
    const map = {
      addLayer: (layer: { id: string; slot?: string }) => {
        added.push(layer);
      },
      getLayer: (id: string) => added.find((layer) => layer.id === id),
      setSlot: vi.fn(),
    };
    addOverlayLayer(map as never, {
      id: "rc-overlay-counties-line",
      type: "line",
      source: "rc-overlay-counties",
    } as never);
    expect(added[0]?.slot).toBe("top");
    expect(map.setSlot).toHaveBeenCalledWith("rc-overlay-counties-line", "top");
  });
});

describe("default layer visibility", () => {
  it("turns operational overlays and live traffic on", () => {
    expect(DEFAULT_LAYER_VISIBILITY.liveTraffic).toBe(true);
    expect(DEFAULT_LAYER_VISIBILITY.liveTrafficClosures).toBe(true);
    expect(DEFAULT_LAYER_VISIBILITY.psaps).toBe(true);
    expect(DEFAULT_LAYER_VISIBILITY.hospitals).toBe(true);
    expect(DEFAULT_LAYER_VISIBILITY.education).toBe(true);
    expect(DEFAULT_LAYER_VISIBILITY.counties).toBe(true);
  });

  it("ignores pre-v2 saved prefs that had traffic and overlays off", () => {
    expect(mapLayersStorageKey("user-1", "core")).toBe("rc-map-layers:v2:user:user-1:core");
  });
});
