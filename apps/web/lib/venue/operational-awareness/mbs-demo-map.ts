/**
 * Illustrative MBS demonstration configuration only.
 * Not an official Mercedes-Benz Stadium floor plan. Do not persist or mix
 * these records into production location/incident APIs.
 */
import type {
  ExteriorLayerId,
  FacilityLayerId,
  VenueDemoIncident,
  VenueLevel,
  VenueOperationalAsset,
  VenueOperationalMap,
  VenueEntrance,
} from "rapid-cortex-shared";
import { buildDemoStadiumZones } from "./demo-stadium-geometry";

const VENUE_ID = "MBS";

const LEVELS: VenueLevel[] = [
  { id: "exterior", name: "Exterior", shortName: "EXT", order: 0, enabled: true },
  { id: "field", name: "Field", shortName: "FLD", order: 1, enabled: true },
  { id: "level-1", name: "Level 1", shortName: "L1", order: 2, enabled: true },
  { id: "level-2", name: "Level 2", shortName: "L2", order: 3, enabled: true },
  { id: "club", name: "Club", shortName: "CLB", order: 4, enabled: true },
  { id: "suites", name: "Suites", shortName: "STE", order: 5, enabled: true },
  { id: "upper", name: "Upper", shortName: "UPR", order: 6, enabled: true },
];

const EXTERIOR_LAYERS: ExteriorLayerId[] = [
  "incidents",
  "security",
  "ems",
  "cameras",
  "entrances",
  "staging",
];

const FACILITY_LAYERS: FacilityLayerId[] = [
  "incidents",
  "security",
  "medical",
  "cameras",
  "entrances",
  "exits",
  "stairs",
  "elevators",
  "escalators",
  "qrZones",
  "restricted",
  "fireSafety",
  "operationalZones",
];

const ASSETS: VenueOperationalAsset[] = [
  { id: "CAM-C124-03", venueId: VENUE_ID, levelId: "level-2", zoneId: "section-124", type: "camera", name: "CAM-C124-03", interiorCoordinates: { x: 250, y: 210 }, status: "online", isDemo: true },
  { id: "CAM-C124-04", venueId: VENUE_ID, levelId: "level-2", zoneId: "section-124", type: "camera", name: "CAM-C124-04", interiorCoordinates: { x: 290, y: 188 }, status: "online", isDemo: true },
  { id: "AED-C124-01", venueId: VENUE_ID, levelId: "level-2", zoneId: "section-124", type: "aed", name: "AED-C124-01", interiorCoordinates: { x: 232, y: 168 }, status: "online", isDemo: true },
  { id: "SECURITY-C124-02", venueId: VENUE_ID, levelId: "level-2", zoneId: "section-124", type: "security", name: "SECURITY-C124-02", interiorCoordinates: { x: 268, y: 230 }, status: "online", isDemo: true },
  { id: "CAM-101-N", venueId: VENUE_ID, levelId: "level-1", zoneId: "section-101", type: "camera", name: "CAM-101-N", interiorCoordinates: { x: 560, y: 160 }, status: "online", isDemo: true },
  { id: "CAM-GA-ENT", venueId: VENUE_ID, levelId: "level-1", zoneId: "gate-a", type: "camera", name: "CAM-GA-ENT", interiorCoordinates: { x: 450, y: 78 }, status: "online", isDemo: true },
  { id: "STAIR-N-01", venueId: VENUE_ID, levelId: "level-1", type: "stairs", name: "North Stairs", interiorCoordinates: { x: 390, y: 92 }, isDemo: true },
  { id: "STAIR-S-01", venueId: VENUE_ID, levelId: "level-1", type: "stairs", name: "South Stairs", interiorCoordinates: { x: 510, y: 455 }, isDemo: true },
  { id: "ESC-C-01", venueId: VENUE_ID, levelId: "level-2", type: "escalator", name: "Concourse C Escalator", interiorCoordinates: { x: 200, y: 300 }, isDemo: true },
  { id: "ELV-CLUB-01", venueId: VENUE_ID, levelId: "club", type: "elevator", name: "Club Elevator", interiorCoordinates: { x: 620, y: 140 }, status: "online", isDemo: true },
  { id: "QR-S124", venueId: VENUE_ID, levelId: "level-2", zoneId: "section-124", type: "qrZone", name: "QR Section 124", interiorCoordinates: { x: 310, y: 215 }, isDemo: true },
  { id: "EXIT-N", venueId: VENUE_ID, levelId: "level-1", type: "exit", name: "Emergency Exit N", interiorCoordinates: { x: 330, y: 70 }, isDemo: true },
  { id: "FIRE-C3", venueId: VENUE_ID, levelId: "level-1", zoneId: "section-c3", type: "fireExtinguisher", name: "Fire Ext. C3", interiorCoordinates: { x: 640, y: 360 }, isDemo: true },
  {
    id: "CAM-EXT-N",
    venueId: VENUE_ID,
    type: "camera",
    name: "Exterior North Camera",
    exteriorCoordinates: [-84.4009, 33.7564],
    status: "online",
    isDemo: true,
  },
  {
    id: "CAM-EXT-S",
    venueId: VENUE_ID,
    type: "camera",
    name: "Exterior South Camera",
    exteriorCoordinates: [-84.4007, 33.7541],
    status: "online",
    isDemo: true,
  },
  {
    id: "SECURITY-EXT-01",
    venueId: VENUE_ID,
    type: "security",
    name: "North Perimeter Security",
    exteriorCoordinates: [-84.4016, 33.7561],
    status: "online",
    isDemo: true,
  },
  {
    id: "EMS-EXT-01",
    venueId: VENUE_ID,
    type: "firstAid",
    name: "EMS Unit 1",
    exteriorCoordinates: [-84.4024, 33.7546],
    status: "online",
    isDemo: true,
  },
  { id: "CAM-L1-W", venueId: VENUE_ID, levelId: "level-1", type: "camera", name: "CAM-L1-W", interiorCoordinates: { x: 160, y: 250 }, status: "online", isDemo: true },
  { id: "CAM-L1-E", venueId: VENUE_ID, levelId: "level-1", type: "camera", name: "CAM-L1-E", interiorCoordinates: { x: 740, y: 270 }, status: "online", isDemo: true },
  { id: "AED-L1-N", venueId: VENUE_ID, levelId: "level-1", type: "aed", name: "AED-L1-N", interiorCoordinates: { x: 450, y: 86 }, status: "online", isDemo: true },
  { id: "SECURITY-L1-M", venueId: VENUE_ID, levelId: "level-1", type: "security", name: "Main Gate Security", interiorCoordinates: { x: 450, y: 470 }, status: "online", isDemo: true },
];

const ENTRANCES: VenueEntrance[] = [
  {
    id: "GATE-04",
    venueId: VENUE_ID,
    name: "Gate 04",
    kind: "public",
    levelId: "level-1",
    exteriorCoordinates: [-84.3996, 33.7558],
    interiorCoordinates: { x: 620, y: 200 },
    isDemo: true,
  },
  {
    id: "MAIN-ENT",
    venueId: VENUE_ID,
    name: "Main Entrance",
    kind: "public",
    levelId: "level-1",
    exteriorCoordinates: [-84.4008, 33.7539],
    interiorCoordinates: { x: 450, y: 502 },
    isDemo: true,
  },
  {
    id: "EMS-STAGING",
    venueId: VENUE_ID,
    name: "EMS Staging",
    kind: "emergency",
    exteriorCoordinates: [-84.4024, 33.7546],
    isDemo: true,
  },
];

const DEMO_INCIDENTS: VenueDemoIncident[] = [
  {
    id: "INC-DEMO-001",
    type: "medical",
    title: "Medical Assistance",
    levelId: "level-2",
    zoneId: "section-124",
    section: "124",
    locationLabel: "Concourse C",
    status: "dispatched",
    severity: "high",
    reportedAt: "2026-08-25T12:41:00.000Z",
    nearby: [
      { label: "AED", distanceFt: 118 },
      { label: "Security Officer", distanceFt: 95 },
      { label: "Medical Team", distanceFt: 220 },
    ],
    cameras: ["CAM-C124-03", "CAM-C124-04"],
    isDemo: true,
  },
];

export const MBS_DEMO_OPERATIONAL_MAP: VenueOperationalMap = {
  venueId: VENUE_ID,
  name: "Mercedes-Benz Stadium",
  isDemo: true,
  exterior: {
    center: [-84.4008, 33.7553],
    zoom: 16.5,
    bounds: [
      [-84.408, 33.749],
      [-84.394, 33.761],
    ],
  },
  levels: LEVELS,
  zones: buildDemoStadiumZones(),
  assets: ASSETS,
  entrances: ENTRANCES,
  facilityModel: { type: "svg", source: "demo-stadium" },
  exteriorLayers: EXTERIOR_LAYERS,
  facilityLayers: FACILITY_LAYERS,
  demoIncidents: DEMO_INCIDENTS,
};

const MBS_ALIASES = new Set(["MBS", "MERCEDES", "MERCEDESBENZ", "MERCEDES-BENZ-STADIUM"]);

export function isMbsDemoVenue(venueId: string): boolean {
  const key = venueId.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return MBS_ALIASES.has(key) || key.includes("MBS");
}
