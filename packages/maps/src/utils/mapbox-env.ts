import mapboxgl from "mapbox-gl";

let applied = false;

/** Supports both env names used across Rapid Cortex deployments. */
export function ensureMapboxAccessToken(): void {
  if (applied && mapboxgl.accessToken) return;
  const token =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim()) ||
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_MAPBOX_TOKEN?.trim()) ||
    "";
  if (token) {
    mapboxgl.accessToken = token;
    applied = true;
  }
}
