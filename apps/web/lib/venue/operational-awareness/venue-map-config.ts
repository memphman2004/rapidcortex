import type { VenueLevel, VenueOperationalMap, VenueZoneStatus } from "rapid-cortex-shared";

export type VenueMapRenderer = "svg" | "als2d" | "als3d";

/** Camera used for the isometric operational map look. */
export const VENUE_ALS_ISO = {
  pitch: 55,
  bearing: 335,
  zoom: 16.5,
} as const;

export interface VenueMapConfig {
  venueId: string;
  venueName: string;
  renderer: VenueMapRenderer;
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  levels: Array<{ id: string; label: string; order: number }>;
  /** Same-origin GeoJSON — never a missing CDN host. */
  geojsonBase: string;
  isDemo: boolean;
}

function levelLabel(level: VenueLevel): string {
  return level.shortName ? `${level.name}` : level.name;
}

/**
 * Self-selects renderer for a venue. Demo catalogs use ALS 3D (fill-extrusion).
 * Venues without GeoJSON stay on SVG until floor plans are processed.
 */
export function buildVenueMapConfig(map: VenueOperationalMap): VenueMapConfig {
  const hasDemoGeometry = map.isDemo && map.zones.length > 0;
  return {
    venueId: map.venueId,
    venueName: map.name,
    renderer: hasDemoGeometry ? "als3d" : "svg",
    center: map.exterior.center,
    zoom: Math.max(map.exterior.zoom, VENUE_ALS_ISO.zoom),
    bearing: VENUE_ALS_ISO.bearing,
    pitch: VENUE_ALS_ISO.pitch,
    levels: map.levels
      .filter((level) => level.enabled)
      .map((level) => ({ id: level.id, label: levelLabel(level), order: level.order })),
    geojsonBase: `/api/venue/code/${encodeURIComponent(map.venueId)}/map`,
    isDemo: map.isDemo,
  };
}

export function statusForAlsMap(status: VenueZoneStatus | undefined): string {
  if (status === "incident") return "incident";
  if (status === "attention") return "elevated";
  return "clear";
}
