"use client";

import { useEffect, useMemo, useRef } from "react";
import type mapboxgl from "mapbox-gl";
import {
  COVERAGE_BORDER_LAYER_ID,
  COVERAGE_FILL_LAYER_ID,
  COVERAGE_SOURCE_ID,
  filterFeaturesByIds,
  RC_COLOR_BORDER_EXPRESSION,
  RC_COLOR_FILL_EXPRESSION,
  stampColorIndexWithCountyFallback,
} from "@/lib/map/apply-four-color";
import { normalizeUsStateKey } from "@/lib/map/us-state-colors";

type CoverageMarker = { state?: string; region?: string; city?: string };

let cachedStatesGeoJson: GeoJSON.FeatureCollection | null = null;
let statesGeoJsonPromise: Promise<GeoJSON.FeatureCollection> | null = null;
let cachedCountiesGeoJson: GeoJSON.FeatureCollection | null = null;
let countiesGeoJsonPromise: Promise<GeoJSON.FeatureCollection | null> | null = null;

async function loadUsStatesGeoJson(): Promise<GeoJSON.FeatureCollection> {
  if (cachedStatesGeoJson) return cachedStatesGeoJson;
  if (!statesGeoJsonPromise) {
    statesGeoJsonPromise = fetch("/geo/us-states.json")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load US states GeoJSON (${res.status})`);
        return res.json() as Promise<GeoJSON.FeatureCollection>;
      })
      .then((data) => {
        cachedStatesGeoJson = data;
        return data;
      })
      .catch((err) => {
        statesGeoJsonPromise = null;
        throw err;
      });
  }
  return statesGeoJsonPromise;
}

async function loadUsCountiesGeoJson(): Promise<GeoJSON.FeatureCollection | null> {
  if (cachedCountiesGeoJson) return cachedCountiesGeoJson;
  if (!countiesGeoJsonPromise) {
    countiesGeoJsonPromise = fetch("/geo/us-counties.json")
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<GeoJSON.FeatureCollection>;
      })
      .then((data) => {
        if (data) cachedCountiesGeoJson = data;
        return data;
      })
      .catch(() => {
        countiesGeoJsonPromise = null;
        return null;
      });
  }
  return countiesGeoJsonPromise;
}

function ensureCoverageLayers(map: mapboxgl.Map): void {
  if (!map.getSource(COVERAGE_SOURCE_ID)) {
    map.addSource(COVERAGE_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  if (!map.getLayer(COVERAGE_FILL_LAYER_ID)) {
    map.addLayer({
      id: COVERAGE_FILL_LAYER_ID,
      type: "fill",
      source: COVERAGE_SOURCE_ID,
      paint: {
        "fill-color": RC_COLOR_FILL_EXPRESSION,
        "fill-opacity": 1,
      },
    });
  }

  if (!map.getLayer(COVERAGE_BORDER_LAYER_ID)) {
    map.addLayer({
      id: COVERAGE_BORDER_LAYER_ID,
      type: "line",
      source: COVERAGE_SOURCE_ID,
      paint: {
        "line-color": RC_COLOR_BORDER_EXPRESSION,
        "line-width": 1.5,
      },
    });
  }
}

/**
 * Renders four-colored state polygons for agencies present on the deployments map.
 */
export function DeploymentsCoverageLayer({
  map,
  markers,
  enabled = true,
}: {
  map: mapboxgl.Map | null;
  markers: CoverageMarker[];
  enabled?: boolean;
}) {
  const cancelledRef = useRef(false);
  const coverageKey = useMemo(() => {
    const states = new Set<string>();
    const counties = new Set<string>();
    for (const m of markers) {
      const stateKey = normalizeUsStateKey(m.state);
      if (stateKey) {
        states.add(stateKey);
        continue;
      }
      const region = (m.region ?? "").trim();
      if (/^\d{4,5}$/.test(region)) counties.add(region.padStart(5, "0"));
    }
    return {
      states: [...states].sort().join(","),
      counties: [...counties].sort().join(","),
    };
  }, [markers]);

  useEffect(() => {
    cancelledRef.current = false;
    if (!map || !enabled) return;

    const stateIds = new Set(
      coverageKey.states ? coverageKey.states.split(",").filter(Boolean) : [],
    );
    const countyIds = new Set(
      coverageKey.counties ? coverageKey.counties.split(",").filter(Boolean) : [],
    );

    const apply = async () => {
      try {
        const parts: GeoJSON.Feature[] = [];
        if (stateIds.size > 0) {
          const raw = await loadUsStatesGeoJson();
          if (cancelledRef.current || !map.getStyle()) return;
          parts.push(...filterFeaturesByIds(raw, stateIds, "id").features);
        }
        if (countyIds.size > 0) {
          const counties = await loadUsCountiesGeoJson();
          if (cancelledRef.current || !map.getStyle()) return;
          if (counties) {
            parts.push(...filterFeaturesByIds(counties, countyIds, "GEOID").features);
          }
        }
        const stamped = stampColorIndexWithCountyFallback(
          { type: "FeatureCollection", features: parts },
          "id",
          "GEOID",
        );

        ensureCoverageLayers(map);
        const source = map.getSource(COVERAGE_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
        source?.setData(stamped);
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[DeploymentsCoverageLayer] could not apply four-color coverage", err);
        }
      }
    };

    const run = () => {
      void apply();
    };

    if (map.isStyleLoaded()) run();
    else map.once("load", run);

    map.on("style.load", run);

    return () => {
      cancelledRef.current = true;
      map.off("load", run);
      map.off("style.load", run);
      if (map.getStyle()) {
        if (map.getLayer(COVERAGE_BORDER_LAYER_ID)) map.removeLayer(COVERAGE_BORDER_LAYER_ID);
        if (map.getLayer(COVERAGE_FILL_LAYER_ID)) map.removeLayer(COVERAGE_FILL_LAYER_ID);
        if (map.getSource(COVERAGE_SOURCE_ID)) map.removeSource(COVERAGE_SOURCE_ID);
      }
    };
  }, [map, coverageKey, enabled]);

  return null;
}
