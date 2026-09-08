export type MapKitTokenProvider = () => Promise<string>;

export type MapKitMapInstance = mapkit.Map;

export type AlsMapInstance = import("maplibre-gl").Map;

export interface LatLng {
  lat: number;
  lng: number;
}
