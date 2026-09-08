import type maplibregl from "maplibre-gl";

export type MapTheme = "dark" | "light" | "satellite" | "streets";

/** [longitude, latitude] */
export type LngLatTuple = [number, number];

export type LocationConfidence = "high" | "medium" | "low";

export type SurgeSuggestedPriority = "critical" | "high" | "medium" | "low";

export type MapInitializedCallback = (map: maplibregl.Map) => void;

export type LocationSample = {
  lat: number;
  lng: number;
  accuracyM?: number;
  capturedAtMs?: number;
};
