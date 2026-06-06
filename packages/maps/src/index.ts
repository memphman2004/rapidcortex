/** Shared Mapbox GL building blocks for Rapid Cortex (web / future desktop shell). */

export type {
  LocationConfidence,
  LocationSample,
  LngLatTuple,
  MapInitializedCallback,
  MapTheme,
  SurgeSuggestedPriority,
} from "./types/map-types";

export { RapidCortexMap, type RapidCortexMapProps } from "./components/RapidCortexMap";
export { LocationMarker, type LocationMarkerProps } from "./components/LocationMarker";
export { ClusterMarker, type ClusterMarkerProps } from "./components/ClusterMarker";
export {
  ResponderMarker,
  type ResponderMarkerProps,
  type ResponderType,
} from "./components/ResponderMarker";
export { IncidentMarker, type IncidentMarkerProps } from "./components/IncidentMarker";
export { AccuracyCircle, type AccuracyCircleProps } from "./components/AccuracyCircle";
export { RouteLayer, type RouteLayerProps } from "./components/RouteLayer";
export { EventZones, type EventZonesProps } from "./components/EventZones";
export { HeatMap, type HeatMapProps } from "./components/HeatMap";

export { useMapbox, type UseMapboxOptions } from "./hooks/useMapbox";
export { useMapControls } from "./hooks/useMapControls";
export { useLocationTracking } from "./hooks/useLocationTracking";

export { ensureMapboxAccessToken } from "./utils/mapbox-env";
export { RAPID_CORTEX_MAP_STYLES } from "./utils/map-styles";
export {
  createAccuracyCirclePolygon,
  emptyFeatureCollection,
  lineStringFeature,
} from "./utils/geojson-helpers";
export { offsetMeters } from "./utils/coordinate-utils";

export type { Map, MapMouseEvent, Marker, Popup } from "mapbox-gl";

export { AppleMapView, type AppleMapViewProps } from "./mapkit/AppleMapView";
export {
  AppleLocationMarker,
  AppleClusterMarker,
  AppleResponderMarker,
  type AppleLocationMarkerProps,
  type AppleClusterMarkerProps,
  type AppleResponderMarkerProps,
  type AppleClusterPriority,
  type AppleResponderType,
  type AppleResponderStatus,
} from "./mapkit/AppleMapMarkers";
export { HybridMapView, type HybridMapViewProps } from "./mapkit/HybridMapView";
export { loadMapKitJs } from "./mapkit/load-mapkit";
export type { LatLng, MapKitMapInstance, MapKitTokenProvider } from "./mapkit/types";
