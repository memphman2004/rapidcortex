import type { CampusInfoTabPublic } from "../campus/info-tab.js";


export type SafetyPointCoordinateSource =
  | "DEVICE_GPS"
  | "MAP_PIN"
  | "GIS_IMPORT"
  | "MANUAL";

export type SafetyPointVerificationStatus = "DRAFT" | "UNVERIFIED" | "VERIFIED";

/** Registered installation location for a QR/NFC safety point (not caller GPS). */
export interface RegisteredSafetyPointLocation {
  latitude: number;
  longitude: number;
  coordinateSource: SafetyPointCoordinateSource;
  horizontalAccuracyMeters?: number;
  buildingName?: string;
  buildingId?: string;
  floor?: string;
  room?: string;
  zone?: string;
  indoorMapId?: string;
  indoorFeatureId?: string;
  verificationStatus: SafetyPointVerificationStatus;
  verifiedAt?: string;
  verifiedBy?: string;
  locationCapturedAt?: string;
  lastLocationUpdatedAt?: string;
  locationUpdatedBy?: string;
}

/** Immutable snapshot attached to an incident at report time. */
export interface IncidentSafetyPointSnapshot {
  safetyPointId: string;
  siteCode?: string;
  latitude?: number;
  longitude?: number;
  buildingName?: string;
  floor?: string;
  room?: string;
  zone?: string;
  verificationStatus: string;
  coordinateSource?: string;
  capturedAt: string;
}

export type ReportMedium = "qr" | "nfc" | "sms" | "direct" | "url";

export type ReportVertical = "911" | "campus" | "venue" | "hospital" | "transit";

export type QrNfcReportType = "anonymous" | "identified" | "both";

export interface QRNFCRecord {
  qrId: string;
  agencyId: string;
  agencyName?: string;
  name: string;
  description?: string;
  zoneId?: string;
  zoneName?: string;
  /** Building / site code used for camera ranking when a scan creates an incident. */
  buildingId?: string;
  /** Floor label used for camera ranking (matches camera registry `floor`). */
  floor?: string;
  /**
   * Cameras assigned to this location during inprocessing.
   * On scan, intake opens these cameras first — not a nearest-building guess.
   */
  cameraIds?: string[];
  /** Transit: onboard camera place (bus / train / ferry). */
  vehicleId?: string;
  /** Transit: station / platform / bus depot. */
  stationId?: string;
  /** Transit: route this sign covers. */
  routeId?: string;
  /**
   * Physical campus this location belongs to (multi-campus tenant).
   * Untagged records remain visible on All campuses and the tenant primary site.
   */
  siteCode?: string;
  vertical: ReportVertical;
  reportType: QrNfcReportType;
  nfcEnabled: boolean;
  nfcTagId?: string;
  active: boolean;
  /**
   * `marketing_site` = NexCort iQ homepage/demo booth codes (not a location report).
   * Omitted on location report codes.
   */
  kind?: "location" | "marketing_site";
  url: string;
  qrImageBase64?: string;
  scanCount: number;
  nfcTapCount: number;
  totalEngagements: number;
  lastEngagementAt?: string;
  /** E.164 tap-to-call number shown on public intake (from SMS routing or admin override). */
  callNumber?: string;
  /**
   * Mobile / field NFC programming history (written URLs on physical tags).
   * Optional for backward compatibility with records created before this field existed.
   */
  nfcWriteLog?: QRNFCWriteEvent[];
  /**
   * Registered installation coordinates (agency-approved). Never overwrite with caller GPS.
   * Optional for backward compatibility with tags created before location registration.
   */
  latitude?: number;
  longitude?: number;
  coordinateSource?: SafetyPointCoordinateSource;
  horizontalAccuracyMeters?: number;
  buildingName?: string;
  room?: string;
  indoorMapId?: string;
  indoorFeatureId?: string;
  verificationStatus?: SafetyPointVerificationStatus;
  verifiedAt?: string;
  verifiedBy?: string;
  locationCapturedAt?: string;
  lastLocationUpdatedAt?: string;
  locationUpdatedBy?: string;
  /** Recent location change audit trail (capped by service layer). */
  locationChangeLog?: Array<{
    at: string;
    by: string;
    latitude: number;
    longitude: number;
    coordinateSource: SafetyPointCoordinateSource;
    verificationStatus: SafetyPointVerificationStatus;
    note?: string;
  }>;
  createdBy: string;
  createdByRole: string;
  createdAt: string;
  updatedAt: string;
  ttl?: number;
}

/** One successful NFC tag program event logged from the mobile app. */
export interface QRNFCWriteEvent {
  eventId: string;
  writtenBy: string;
  writtenByName?: string | null;
  devicePlatform: "ios" | "android";
  writeMethod: "native_nfc";
  bytesWritten: number;
  tagType?: string | null;
  writtenAt: string;
}

export interface CreateQRNFCInput {
  agencyId?: string;
  name: string;
  description?: string;
  zoneId?: string;
  zoneName?: string;
  buildingId?: string;
  floor?: string;
  cameraIds?: string[];
  vehicleId?: string;
  stationId?: string;
  routeId?: string;
  siteCode?: string;
  vertical: ReportVertical;
  reportType: QrNfcReportType;
  nfcEnabled?: boolean;
  nfcTagId?: string;
  expiresAt?: string;
  callNumber?: string;
  latitude?: number;
  longitude?: number;
  coordinateSource?: SafetyPointCoordinateSource;
  horizontalAccuracyMeters?: number;
  buildingName?: string;
  room?: string;
  indoorMapId?: string;
  indoorFeatureId?: string;
  verificationStatus?: SafetyPointVerificationStatus;
}

export interface UpdateQRNFCInput {
  name?: string;
  description?: string;
  zoneId?: string;
  zoneName?: string;
  buildingId?: string;
  floor?: string;
  cameraIds?: string[];
  vehicleId?: string;
  stationId?: string;
  routeId?: string;
  siteCode?: string;
  nfcEnabled?: boolean;
  nfcTagId?: string;
  active?: boolean;
  callNumber?: string;
  latitude?: number;
  longitude?: number;
  coordinateSource?: SafetyPointCoordinateSource;
  horizontalAccuracyMeters?: number;
  buildingName?: string;
  room?: string;
  indoorMapId?: string;
  indoorFeatureId?: string;
  /** Set true via dedicated verify action — never implied by GPS capture alone. */
  markLocationVerified?: boolean;
}

/** Public-safe fields for `/report/{qrId}` intake. */
export interface QRNFCPublicRecord {
  qrId: string;
  agencyId: string;
  agencyName: string;
  /** Reporting point name from Create Code (e.g. Boggs Hall, Gate A, Bus 2145). */
  name?: string;
  zoneName?: string;
  vertical: ReportVertical;
  reportType: QrNfcReportType;
  active: boolean;
  medium?: ReportMedium;
  callNumber?: string;
  callNumberDisplay?: string;
  /** Campus agencies only — drives K-12 vs higher-ed public concern categories. */
  institutionType?: "higher_ed" | "k12";
  /** When true, intake should collect a callback phone (campus default). */
  collectPhone?: boolean;
  /** Campus Information tab content for this site / tenant. */
  infoTab?: CampusInfoTabPublic;
  /**
   * Escort iQ™ available on this scan point (higher-ed + flags).
   * Absent/false on K-12 and when feature is disabled.
   */
  escortIqAvailable?: boolean;
  /**
   * NexCort iQ Campus Alerts self-registration available (higher-ed + flags).
   * Absent/false on K-12 and when feature is disabled.
   */
  campusAlertsAvailable?: boolean;
  /** Human-readable registered place (building / floor / zone). */
  locationDescription?: string;
  buildingName?: string;
  floor?: string;
  /** True when registered coordinates exist (not caller GPS). */
  hasRegisteredLocation?: boolean;
  locationVerificationStatus?: SafetyPointVerificationStatus | "MISSING";
}

export interface PublicReportSubmitInput {
  qrId: string;
  message: string;
  locationNote?: string;
  reporterName?: string;
  reporterPhone?: string;
  medium: ReportMedium;
  mediaKeys?: string[];
  shareLiveLocation?: boolean;
}
