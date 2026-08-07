/**
 * Rapid Cortex — Map Type Definitions
 *
 * Shared interfaces for the RapidCortexMap component system.
 * Used by: RapidCortexMapCore, MapLayerControl, supervisor/incident/venue dashboards.
 */

// ─── Incident data ────────────────────────────────────────────────────────────

export type IncidentSeverity = "critical" | "high" | "medium" | "low" | "resolved";
export type IncidentStatus   = "active" | "responding" | "resolved" | "closed";

export interface RCIncident {
  id:             string;
  status:         IncidentStatus;
  severity:       IncidentSeverity;
  type:           string;           // "medical" | "disturbance" | "fire" | etc.
  locationLabel:  string;           // Human-readable — always available
  latitude?:      number;           // May be absent if GPS not captured
  longitude?:     number;
  createdAt:      string;           // ISO 8601
  updatedAt?:     string;
  agencyId?:      string;
  description?:   string;
}

// ─── Caller / report location pin ────────────────────────────────────────────

export interface RCCallerLocation {
  lat:    number;
  lng:    number;
  label?: string;  // e.g. "Section 118, Row 12" — shown in popup
  source?: "gps" | "manual" | "qr" | "nfc" | "sms";
}

// ─── Layer visibility state ───────────────────────────────────────────────────

export interface RCMapLayerVisibility {
  agencyZones:         boolean;
  counties:            boolean;
  stateBoundaries:     boolean;
  airports:            boolean;
  campusZones:         boolean;
  venueZones:          boolean;
  activeIncidents:     boolean;
  resolvedIncidents:   boolean;
  callerPin:           boolean;
  /** Mapbox live traffic flow — Studio layer ID: rc-live-traffic */
  liveTraffic:         boolean;
  /** Mapbox live traffic closures — Studio layer ID: rc-live-traffic-closures */
  liveTrafficClosures: boolean;
}

export const DEFAULT_LAYER_VISIBILITY: RCMapLayerVisibility = {
  agencyZones:         true,
  counties:            true,
  stateBoundaries:     false,
  airports:            false,
  campusZones:         false,
  venueZones:          false,
  activeIncidents:     true,
  resolvedIncidents:   false,
  callerPin:           true,
  liveTraffic:         false,
  liveTrafficClosures: false,
};

// ─── Map component props ──────────────────────────────────────────────────────

export interface RCMapProps {
  /** Center of the map on load — defaults to Atlanta (RC default) */
  centerLng?: number;
  centerLat?: number;
  zoom?: number;

  /** Live incidents rendered as GeoJSON markers */
  incidents?: RCIncident[];

  /** Incident ID to fly to + highlight in a popup */
  selectedIncidentId?: string | null;

  /** Called when a marker or resolved-circle is clicked */
  onIncidentClick?: (incident: RCIncident) => void;

  /** Called once the map style has loaded and sources are ready */
  onMapReady?: () => void;

  /**
   * Caller or report location pin.
   * If only zone/section text exists — set callerLocation to null and pass the
   * label as part of the incident locationLabel; do NOT fabricate coordinates.
   */
  callerLocation?: RCCallerLocation | null;

  /** Override initial layer visibility */
  defaultLayers?: Partial<RCMapLayerVisibility>;

  /** Whether to render the floating layer-toggle control */
  showLayerControl?: boolean;

  /** CSS height of the map container — default "100%" */
  height?: string;

  /** Additional className on the outermost div */
  className?: string;

  /**
   * Vertical context — adjusts which layer groups are shown in the control panel.
   * "core" = 911/PSAP; "campus" = campus safety; "venue" = stadium/arena/airport
   */
  vertical?: "core" | "campus" | "venue" | "airport";

  /** Mapbox Studio style theme — dark (dispatch) vs light */
  theme?: "dark" | "light";

  /** Called when the in-map theme toggle is clicked */
  onThemeChange?: (theme: "dark" | "light") => void;

  /**
   * When set, layer visibility + theme (if uncontrolled) persist to localStorage
   * for this Cognito user id + {@link vertical} across logout/login.
   */
  persistUserId?: string | null;
}
