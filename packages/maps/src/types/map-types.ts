import type mapboxgl from "mapbox-gl";

export type MapTheme = "dark" | "light" | "satellite" | "streets";

/** [longitude, latitude] */
export type LngLatTuple = [number, number];

export type LocationConfidence = "high" | "medium" | "low";

export type SurgeSuggestedPriority = "critical" | "high" | "medium" | "low";

export type MapInitializedCallback = (map: mapboxgl.Map) => void;

export type LocationSample = {
  lat: number;
  lng: number;
  accuracyM?: number;
  capturedAtMs?: number;
};
