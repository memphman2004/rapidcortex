/**
 * Per-campus OSM bounding boxes for Mapbox 3D building extrusion.
 * Bbox format: [minLat, minLng, maxLat, maxLng] (Overpass).
 * Center is [lng, lat] (Mapbox).
 */
export interface CampusOsmConfig {
  campusId: string;
  campusName: string;
  bbox: [number, number, number, number];
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  metersPerFloor: number;
}

export const CAMPUS_OSM_REGISTRY: Record<string, CampusOsmConfig> = {
  CSU: {
    campusId: "CSU",
    campusName: "Columbus State University",
    bbox: [32.468, -84.997, 32.48, -84.983],
    center: [-84.99, 32.474],
    zoom: 15.5,
    bearing: 0,
    pitch: 45,
    metersPerFloor: 4,
  },
  UGA: {
    campusId: "UGA",
    campusName: "University of Georgia",
    bbox: [33.94, -83.38, 33.96, -83.36],
    center: [-83.373, 33.948],
    zoom: 15,
    bearing: 0,
    pitch: 45,
    metersPerFloor: 4,
  },
};

const ALIASES: Record<string, string> = {
  CSU: "CSU",
  COLUMBUSSTATE: "CSU",
  COLUMBUSSTATEUNIVERSITY: "CSU",
  UGA: "UGA",
  UNIVERSITYOFGEORGIA: "UGA",
};

export function normalizeCampusMapId(campusCode: string): string {
  return campusCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function resolveCampusOsmConfig(campusCode: string): CampusOsmConfig | null {
  const normalized = normalizeCampusMapId(campusCode);
  const aliased = ALIASES[normalized];
  if (aliased && CAMPUS_OSM_REGISTRY[aliased]) return CAMPUS_OSM_REGISTRY[aliased]!;
  if (CAMPUS_OSM_REGISTRY[normalized]) return CAMPUS_OSM_REGISTRY[normalized]!;
  const keys = Object.keys(CAMPUS_OSM_REGISTRY).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (normalized === key || normalized.endsWith(key)) {
      return CAMPUS_OSM_REGISTRY[key] ?? null;
    }
  }
  return null;
}

export function listCampusOsmKeys(): string[] {
  return Object.keys(CAMPUS_OSM_REGISTRY);
}

export const CAMPUS_MAPBOX_ISO = {
  pitch: 45,
  bearing: 0,
  zoom: 15.5,
} as const;
