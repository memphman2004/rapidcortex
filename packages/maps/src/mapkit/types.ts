import type mapboxgl from "mapbox-gl";

export type MapKitTokenProvider = () => Promise<string>;

export type MapKitMapInstance = mapkit.Map;

export type MapboxMapInstance = mapboxgl.Map;

export interface LatLng {
  lat: number;
  lng: number;
}
