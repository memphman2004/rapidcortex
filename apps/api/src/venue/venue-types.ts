import { createHash } from "node:crypto";

// ─── FACILITY ────────────────────────────────────────────────────────────────

export type FacilityType =
  | "STADIUM"
  | "ARENA"
  | "AIRPORT"
  | "UNIVERSITY"
  | "SCHOOL"
  | "HOSPITAL"
  | "CONVENTION"
  | "MALL"
  | "GOVERNMENT"
  | "CAMPUS"
  | "OTHER";

export interface EmergencyContact {
  role: string;
  name: string;
  phone: string;
  available24x7: boolean;
  notes?: string;
}

export interface VenueFacility {
  pk: string; // FACILITY#{facilityId}
  sk: "PROFILE";
  facilityId: string;
  agencyId: string;
  name: string;
  address: string;
  addressHash: string; // SHA-256 of normalized address
  lat: number;
  lng: number;
  facilityType: FacilityType;
  floorCount: number;
  capacity?: number;
  timezone: string;
  status: "ACTIVE" | "INACTIVE";
  emergencyContacts: EmergencyContact[];
  accessNotes?: string;
  enrollmentAgreementSignedAt?: string;
  enrollmentAgreementSignedBy?: string;
  cameraRoutingEnabled: boolean;
  enrolledBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── FLOOR PLANS ─────────────────────────────────────────────────────────────

export interface VenueFloorPlan {
  pk: string; // FACILITY#{facilityId}
  sk: string; // FLOOR#{floorNumber}
  facilityId: string;
  floorNumber: number;
  label: string;
  s3Key: string;
  imageWidth: number;
  imageHeight: number;
  uploadedBy: string;
  uploadedAt: string;
}

// ─── ASSETS ──────────────────────────────────────────────────────────────────

export type AssetType =
  | "AED"
  | "FIRE_PANEL"
  | "FIRE_EXTINGUISHER"
  | "HYDRANT"
  | "EMERGENCY_EXIT"
  | "STAIRWELL"
  | "ELEVATOR"
  | "STAGING_AREA"
  | "COMMAND_POST"
  | "EVACUATION_ROUTE"
  | "HAZMAT_STORAGE"
  | "UTILITY_SHUTOFF"
  | "FIRST_AID"
  | "MUSTER_POINT";

export interface VenueAsset {
  pk: string; // FACILITY#{facilityId}
  sk: string; // ASSET#{assetId}
  assetId: string;
  facilityId: string;
  agencyId: string;
  assetType: AssetType;
  label: string;
  floor: number;
  x: number;
  y: number;
  notes?: string;
  metadata?: Record<string, string>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── CAMERAS (facility's own on-site cameras) ─────────────────────────────────

export interface VenueCamera {
  pk: string; // FACILITY#{facilityId}
  sk: string; // CAMERA#{cameraId}
  cameraId: string;
  facilityId: string;
  agencyId: string;
  label: string;
  protocol: "RTSP" | "ONVIF" | "WEBRTC";
  rtspUrl?: string; // never stored plaintext — use credentialsSecretArn
  onvifHost?: string;
  credentialsSecretArn?: string;
  floor: number;
  x: number;
  y: number;
  location: { label: string; zone?: string };
  accessModel: "STANDING" | "ON_DEMAND" | "EMERGENCY_OVERRIDE";
  status: "ACTIVE" | "OFFLINE" | "DEGRADED" | "DISABLED";
  addedBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── EMERGENCY PLANS ─────────────────────────────────────────────────────────

export type EmergencyPlanType =
  | "ACTIVE_THREAT"
  | "EVACUATION"
  | "LOCKDOWN"
  | "MASS_CASUALTY"
  | "HAZMAT"
  | "FIRE"
  | "MEDICAL"
  | "SEVERE_WEATHER"
  | "BOMB_THREAT"
  | "CROWD_EMERGENCY"
  | "GENERAL";

export interface VenueEmergencyPlan {
  pk: string; // FACILITY#{facilityId}
  sk: string; // PLAN#{planId}
  planId: string;
  facilityId: string;
  agencyId: string;
  planType: EmergencyPlanType;
  title: string;
  s3Key: string;
  version: string;
  effectiveDate: string;
  uploadedBy: string;
  uploadedAt: string;
}

// ─── INCIDENT OVERLAYS ────────────────────────────────────────────────────────

export type OverlayType =
  | "ZONE_MARKER"
  | "ANNOTATION"
  | "COMMAND_POST"
  | "RESPONDER_CHECKIN"
  | "CASUALTY_LOCATION"
  | "STAGING_ACTIVE"
  | "MUSTER_ACTIVE";

export type ZoneType = "HOT" | "WARM" | "COLD" | "STAGING" | "COMMAND";

export interface VenueIncidentOverlay {
  pk: string; // INCIDENT#{incidentId}
  sk: string; // OVERLAY#{overlayId}
  overlayId: string;
  incidentId: string;
  facilityId: string;
  agencyId: string;
  overlayType: OverlayType;
  floor: number;
  x: number;
  y: number;
  label?: string;
  zone?: ZoneType;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  ttl?: number;
}

export interface ResponderCheckin {
  pk: string; // INCIDENT#{incidentId}
  sk: string; // CHECKIN#{userId}
  incidentId: string;
  facilityId: string;
  agencyId: string;
  userId: string;
  displayName: string;
  unitId?: string;
  floor: number;
  zone?: string;
  checkedInAt: string;
  ttl?: number;
}

// ─── CAMERA ACCESS LOG (immutable) ───────────────────────────────────────────

export interface VenueCameraAccessEvent {
  pk: string; // FACILITY#{facilityId}
  sk: string; // ACCESS#{ISO}#{sessionId}
  sessionId: string;
  incidentId: string;
  facilityId: string;
  facilityName: string;
  cameraId: string;
  cameraLabel: string;
  agencyId: string;
  requestedBy: string;
  requestedByName: string;
  accessModel: VenueCamera["accessModel"];
  status: "ACTIVE" | "CLOSED";
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  // NO ttl — permanent records
}

// ─── INTELLIGENCE PAYLOAD ─────────────────────────────────────────────────────

export interface VenueIntelligence {
  facility: VenueFacility;
  floorPlan?: VenueFloorPlan;
  assets: VenueAsset[];
  nearestAEDs: VenueAsset[];
  nearestExits: VenueAsset[];
  nearestFirePanel: VenueAsset | null;
  stagingAreas: VenueAsset[];
  musterPoints: VenueAsset[];
  relevantPlans: VenueEmergencyPlan[];
  cameras: VenueCamera[]; // only if cameraRoutingEnabled + incidentId provided
  activeOverlays: VenueIncidentOverlay[];
  responderCheckins: ResponderCheckin[];
  eventContext?: string;
}

// ─── REQUEST SHAPES ───────────────────────────────────────────────────────────

export interface RegisterFacilityRequest {
  name: string;
  address: string;
  lat: number;
  lng: number;
  facilityType: FacilityType;
  floorCount: number;
  capacity?: number;
  timezone?: string;
  emergencyContacts: EmergencyContact[];
  accessNotes?: string;
}

export interface AddAssetRequest {
  assetType: AssetType;
  label: string;
  floor: number;
  x: number;
  y: number;
  notes?: string;
  metadata?: Record<string, string>;
}

export interface CreateOverlayRequest {
  incidentId: string;
  overlayType: OverlayType;
  floor: number;
  x: number;
  y: number;
  label?: string;
  zone?: ZoneType;
}

// ─── UTILITY ─────────────────────────────────────────────────────────────────

export function normalizeAddress(address: string): string {
  return address.toLowerCase().replace(/\s+/g, " ").trim();
}

export function hashAddress(address: string): string {
  return createHash("sha256").update(normalizeAddress(address)).digest("hex");
}

// ── SMS / Incident types ───────────────────────────────────────────────────

export type VenueIncidentStatus =
  | "open"
  | "assigned"
  | "responding"
  | "resolved"
  | "escalated";

export type VenueIncidentSource = "sms" | "qr" | "manual";

export type VenueIncidentType =
  | "medical"
  | "security"
  | "lost_person"
  | "maintenance"
  | "guest_services"
  | "other";

export interface VenueIncidentRecord {
  pk: string; // VENUE#MBS
  sk: string; // INCIDENT#MBS-2026-000247
  incidentId: string; // MBS-2026-000247
  venueCode: string;
  zoneCode: string; // S124 - empty string if unknown
  zoneLabel: string; // "Section 124" - "Location not specified" if unknown
  qrRcli?: string;
  qrLocationName?: string;
  type: VenueIncidentType;
  source: VenueIncidentSource;
  status: VenueIncidentStatus;
  description: string;
  callerPhone: string; // E.164 - from Twilio From field
  hasMedia: boolean;
  mediaUrls: string[];
  cameraRefs: string[];
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  ttl?: number;
}

export interface VenueConfigRecord {
  pk: string; // VENUE_CONFIG#MBS
  sk: string; // CONFIG
  venueCode: string;
  venueName: string;
  active: boolean;
  smsEnabled: boolean;
  qrEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VenueZoneConfigRecord {
  pk: string; // VENUE_CONFIG#MBS
  sk: string; // ZONE#S124
  venueCode: string;
  zoneCode: string;
  zoneLabel: string;
  level: string;
  cameraIds: string[];
  sharedVenues?: string[]; // e.g. ["MBS", "SFA"] for shared parking zones
  active: boolean;
}

export interface VenueEventScheduleRecord {
  pk: string; // EVENT_SCHEDULE#MBS
  sk: string; // EVENT#2026-05-31T19:00:00Z
  venueCode: string;
  venueName: string;
  eventName: string;
  eventType: string; // nfl | nba | mls | concert | ncaa | other
  eventStart: string; // ISO
  eventEnd: string; // ISO - includes post-event crowd window
  expectedAttendance: number;
  active: boolean;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
}

export interface SmsDisambiguationSession {
  pk: string; // SMS_SESSION#+14045551234
  sk: string; // SESSION
  phoneE164: string;
  venueCode: string | null;
  pendingMessage: string;
  pendingMediaUrls: string[];
  awaitingReply: boolean;
  candidateVenueCodes: string[];
  createdAt: string;
  updatedAt: string;
  ttl: number; // Unix epoch seconds
}
