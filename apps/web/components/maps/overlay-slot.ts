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

/** Mapbox Studio defaults that ALS Maps V2 does not host (Network 404 on `0-255.pbf`). */
const REJECTED_GLYPH_FONTS = /din\s*offc|arial unicode/i;

function isAlsNativeFontStack(font: string[]): boolean {
  return font.length > 0 && !font.some((name) => REJECTED_GLYPH_FONTS.test(name));
}

/**
 * ALS Maps V2 glyphs only serve fonts already in the loaded style.
 * Skip Studio leftovers like "DIN Offc Pro Medium" even if a layer still lists them.
 */
export function firstSymbolFont(map: maplibregl.Map): string[] {
  const stacks: string[][] = [];
  for (const layer of map.getStyle()?.layers ?? []) {
    if (layer.type !== "symbol") continue;
    const font = (layer.layout as { "text-font"?: string[] } | undefined)?.["text-font"];
    if (Array.isArray(font) && font.length > 0) stacks.push(font);
  }
  return stacks.find(isAlsNativeFontStack) ?? ["Noto Sans Regular"];
}

/** addLayer that never aborts overlay setup when a glyph/font spec is rejected. */
export function tryAddOverlayLayer(map: maplibregl.Map, layer: LayerSpec): boolean {
  try {
    addOverlayLayer(map, layer);
    return true;
  } catch {
    return false;
  }
}
