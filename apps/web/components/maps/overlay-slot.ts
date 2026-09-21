import type maplibregl from "maplibre-gl";

/** Amazon Location Maps V2 only paints custom layers that belong to a slot. */
export const OVERLAY_SLOT = "top";

type LayerSpec = maplibregl.LayerSpecification & { slot?: string };

/** Spread onto MapLibre `addLayer` specs so overlays sit above the ALS basemap. */
export function withOverlaySlot<T extends object>(layer: T): T & { slot: string } {
  return { ...layer, slot: OVERLAY_SLOT };
}

export function promoteOverlaySlot(map: maplibregl.Map, layerId: string): void {
  if (!map.getLayer(layerId)) return;
  try {
    const withSlot = map as maplibregl.Map & {
      setSlot?: (id: string, slot: string) => void;
    };
    withSlot.setSlot?.(layerId, OVERLAY_SLOT);
  } catch {
    /* V1 named maps ignore slots */
  }
}

export function addOverlayLayer(map: maplibregl.Map, layer: LayerSpec): void {
  map.addLayer(withOverlaySlot(layer) as maplibregl.LayerSpecification);
  promoteOverlaySlot(map, layer.id);
}

export function promoteOverlaySlots(map: maplibregl.Map, layerIds: readonly string[]): void {
  for (const id of layerIds) promoteOverlaySlot(map, id);
}
