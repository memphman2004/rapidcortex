/**
 * Venue Operational Awareness map model.
 * Geometry is renderer-specific (`unknown` / SVG/GeoJSON/GLTF) so SVG today
 * can be swapped for Three.js later without changing dashboard state.
 */

export const OPERATIONAL_VIEW_MODES = ["split", "area", "facility"] as const;
export type OperationalViewMode = (typeof OPERATIONAL_VIEW_MODES)[number];

export const FACILITY_LAYER_IDS = [
  "incidents",
  "security",
  "medical",
  "cameras",
  "entrances",
  "exits",
  "stairs",
  "elevators",
  "escalators",
  "restricted",
  "qrZones",
  "guestServices",
  "fireSafety",
  "operationalZones",
] as const;
export type FacilityLayerId = (typeof FACILITY_LAYER_IDS)[number];

export const EXTERIOR_LAYER_IDS = [
  "incidents",
  "security",
  "ems",
  "police",
  "fire",
  "cameras",
  "entrances",
  "staging",
  "roadClosures",
] as const;
export type ExteriorLayerId = (typeof EXTERIOR_LAYER_IDS)[number];

export interface VenueLevel {
  id: string;
  name: string;
  shortName?: string;
  order: number;
  elevation?: number;
  enabled: boolean;
}

export type VenueZoneType =
  | "section"
  | "concourse"
  | "room"
  | "field"
  | "suite"
  | "restricted"
  | "operational";

export type VenueZoneStatus = "normal" | "attention" | "incident";

export type SvgZoneGeometry =
  | { kind: "path"; d: string }
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "rect"; x: number; y: number; width: number; height: number; rx?: number };

export interface VenueOperationalZone {
  id: string;
  venueId: string;
  levelId: string;
  name: string;
  type: VenueZoneType;
  section?: string;
  geometry: SvgZoneGeometry;
  status?: VenueZoneStatus;
  labelX?: number;
  labelY?: number;
}

export type VenueAssetType =
  | "camera"
  | "aed"
  | "security"
  | "firstAid"
  | "elevator"
  | "escalator"
  | "stairs"
  | "exit"
  | "entrance"
  | "fireExtinguisher"
  | "qrZone";

export interface VenueOperationalAsset {
  id: string;
  venueId: string;
  levelId?: string;
  zoneId?: string;
  type: VenueAssetType;
  name: string;
  exteriorCoordinates?: [number, number];
  interiorCoordinates?: { x: number; y: number };
  status?: "online" | "offline" | "warning";
  isDemo?: boolean;
}

export type VenueEntranceKind = "public" | "emergency" | "staff" | "loading";

export interface VenueEntrance {
  id: string;
  venueId: string;
  name: string;
  kind: VenueEntranceKind;
  levelId?: string;
  exteriorCoordinates?: [number, number];
  interiorCoordinates?: { x: number; y: number };
  isDemo?: boolean;
}

export interface VenueFacilityModelRef {
  type: "svg" | "geojson" | "gltf";
  source: string;
}

export interface VenueDemoIncident {
  id: string;
  type: string;
  title: string;
  levelId: string;
  zoneId: string;
  section: string;
  locationLabel: string;
  status: string;
  severity: "high" | "medium" | "low";
  reportedAt: string;
  nearby: Array<{ label: string; distanceFt: number }>;
  cameras: string[];
  isDemo: true;
}

export interface VenueOperationalMap {
  venueId: string;
  name: string;
  /** Fictional / illustrative layout — never mix into production persistence. */
  isDemo: boolean;
  exterior: {
    center: [number, number];
    zoom: number;
    bounds?: [[number, number], [number, number]];
  };
  levels: VenueLevel[];
  zones: VenueOperationalZone[];
  assets: VenueOperationalAsset[];
  entrances: VenueEntrance[];
  facilityModel?: VenueFacilityModelRef;
  exteriorLayers: ExteriorLayerId[];
  facilityLayers: FacilityLayerId[];
  demoIncidents?: VenueDemoIncident[];
}

export interface FacilityMapRendererProps {
  venue: VenueOperationalMap;
  activeLevelId?: string;
  selectedIncidentId?: string | null;
  selectedZoneId?: string | null;
  visibleLayers: readonly string[];
  onIncidentSelect: (id: string) => void;
  onZoneSelect: (id: string) => void;
  onAssetSelect: (id: string) => void;
}
