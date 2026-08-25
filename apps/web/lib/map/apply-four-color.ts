import type { ExpressionSpecification } from "mapbox-gl";
import { buildAdjacencyFromGeoJSON, greedyColor } from "./graph-color";
import { REGION_COLORS, type RegionColorIndex } from "./region-colors";
import {
  normalizeUsStateKey,
  US_FIPS_COLOR_INDEX,
  US_STATE_COLOR_INDEX,
} from "./us-state-colors";

export const COVERAGE_SOURCE_ID = "rc-coverage-regions";
export const COVERAGE_FILL_LAYER_ID = "rc-coverage-fill";
export const COVERAGE_BORDER_LAYER_ID = "rc-coverage-border";

export const RC_COLOR_FILL_EXPRESSION = [
  "match",
  ["get", "rcColorIndex"],
  0,
  REGION_COLORS[0].fill,
  1,
  REGION_COLORS[1].fill,
  2,
  REGION_COLORS[2].fill,
  3,
  REGION_COLORS[3].fill,
  REGION_COLORS[0].fill,
] as ExpressionSpecification;

export const RC_COLOR_BORDER_EXPRESSION = [
  "match",
  ["get", "rcColorIndex"],
  0,
  REGION_COLORS[0].border,
  1,
  REGION_COLORS[1].border,
  2,
  REGION_COLORS[2].border,
  3,
  REGION_COLORS[3].border,
  REGION_COLORS[0].border,
] as ExpressionSpecification;

function featureRawId(
  feature: GeoJSON.Feature,
  idProp: string,
): string {
  if (idProp === "id") return String(feature.id ?? feature.properties?.id ?? "");
  return String(feature.properties?.[idProp] ?? feature.id ?? "");
}

/**
 * State-table lookup. Returns undefined when the id is not a USPS abbrev or 2-digit FIPS
 * so callers can fall back to county (GEOID) coloring.
 */
export function lookupStateColorIndex(raw: string): RegionColorIndex | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const abbrev = normalizeUsStateKey(trimmed) ?? (trimmed.length === 2 ? trimmed.toUpperCase() : "");
  if (abbrev && abbrev in US_STATE_COLOR_INDEX) return US_STATE_COLOR_INDEX[abbrev];
  if (/^\d{1,2}$/.test(trimmed)) {
    const fips = trimmed.padStart(2, "0");
    if (fips in US_FIPS_COLOR_INDEX) return US_FIPS_COLOR_INDEX[fips];
  }
  return undefined;
}

/**
 * Stamp features with `rcColorIndex` using the pre-computed US state table.
 * Unknown ids default to 0 (same as the previous lookup chain).
 */
export function stampColorIndex(
  geojson: GeoJSON.FeatureCollection,
  idProp: "STUSPS" | "STATEFP" | "id" = "STUSPS",
): GeoJSON.FeatureCollection {
  return {
    ...geojson,
    features: geojson.features.map((f) => {
      const raw = featureRawId(f, idProp);
      const colorIndex = lookupStateColorIndex(raw) ?? 0;
      return {
        ...f,
        properties: { ...f.properties, rcColorIndex: colorIndex },
      };
    }),
  };
}

/**
 * Runtime 4-coloring for county (or other) polygons via shared-border adjacency.
 */
export function stampColorIndexDynamic(
  geojson: GeoJSON.FeatureCollection,
  idProp: string,
): GeoJSON.FeatureCollection {
  const adjacency = buildAdjacencyFromGeoJSON(geojson.features, idProp);
  const colorMap = greedyColor(adjacency);

  return {
    ...geojson,
    features: geojson.features.map((f) => {
      const id = String(f.properties?.[idProp] ?? f.id ?? "");
      const colorIndex = colorMap.get(id) ?? 0;
      return {
        ...f,
        properties: { ...f.properties, rcColorIndex: colorIndex },
      };
    }),
  };
}

/**
 * State table first; remaining features (typically county GEOIDs) are colored
 * by shared-border adjacency so adjacent counties never share a fill.
 */
export function stampColorIndexWithCountyFallback(
  geojson: GeoJSON.FeatureCollection,
  idProp: string = "id",
  countyIdProp: string = "GEOID",
): GeoJSON.FeatureCollection {
  const stateResolved: GeoJSON.Feature[] = [];
  const countyFallback: GeoJSON.Feature[] = [];

  for (const f of geojson.features) {
    const raw = featureRawId(f, idProp);
    const stateColor = lookupStateColorIndex(raw);
    if (stateColor !== undefined) {
      stateResolved.push({
        ...f,
        properties: { ...f.properties, rcColorIndex: stateColor },
      });
    } else {
      countyFallback.push(f);
    }
  }

  if (countyFallback.length === 0) {
    return { ...geojson, features: stateResolved };
  }

  const countyProp =
    countyFallback[0]?.properties?.[countyIdProp] != null ? countyIdProp : idProp;
  const countyStamped = stampColorIndexDynamic(
    { type: "FeatureCollection", features: countyFallback },
    countyProp,
  );

  return {
    ...geojson,
    features: [...stateResolved, ...countyStamped.features],
  };
}

/** Keep only features whose id is in `allowedIds` (e.g. states with agencies). */
export function filterFeaturesByIds(
  geojson: GeoJSON.FeatureCollection,
  allowedIds: Set<string>,
  idProp: string = "id",
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: geojson.features.filter((f) => {
      const raw = featureRawId(f, idProp);
      return allowedIds.has(raw.toUpperCase()) || allowedIds.has(raw);
    }),
  };
}
