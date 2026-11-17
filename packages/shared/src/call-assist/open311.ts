/**
 * NEXiQ City Services — Open311 GeoReport v2 Adapter
 *
 * Converts between our internal CallAssistCallRecord format and the
 * Open311 GeoReport v2 standard used by most US municipalities.
 *
 * Standard ref: https://wiki.open311.org/GeoReport_v2/
 *
 * Account: 158961537080 (nexcortiq-prod). Never reference 621957412915.
 *
 * Gate: `config.open311AdapterEnabled === true`.
 *       Existing SR creation and routing are UNCHANGED when the flag is off.
 *
 * Version: Phase 3 initial implementation.
 */

import type { CallAssistCallRecord } from "./call-record.js";

// ---------------------------------------------------------------------------
// Feature flag gate
// ---------------------------------------------------------------------------

export function isOpen311AdapterEnabled(
  config: { open311AdapterEnabled?: boolean } | null | undefined,
): boolean {
  return config?.open311AdapterEnabled === true;
}

// ---------------------------------------------------------------------------
// Open311 GeoReport v2 types
// ---------------------------------------------------------------------------

/** Open311 service (a.k.a. service type in the city's catalog). */
export type Open311Service = {
  service_code: string;
  service_name: string;
  description?: string;
  metadata: boolean;        // True if the service has extended attributes
  type: "realtime" | "batch" | "blackbox";
  keywords?: string[];
  group?: string;
};

/** Open311 service request status values. */
export type Open311Status = "open" | "closed";

/**
 * Open311 GeoReport v2 service request.
 * This is the wire format for both outbound pushes and inbound webhooks.
 */
export type Open311ServiceRequest = {
  service_request_id: string;
  status: Open311Status;
  status_notes?: string;
  service_name?: string;
  service_code?: string;
  description?: string;
  agency_responsible?: string;
  service_notice?: string;
  /** ISO 8601 datetime. */
  requested_datetime: string;
  /** ISO 8601 datetime. */
  updated_datetime?: string;
  /** ISO 8601 datetime. */
  expected_datetime?: string;
  address?: string;
  address_id?: string;
  zipcode?: string;
  lat?: number;
  long?: number;
  media_url?: string;
};

/** Acknowledgement returned by a municipality when we POST a new SR. */
export type Open311PostAck = {
  service_request_id?: string;
  service_notice?: string;
  account_id?: string;
  token?: string;
};

/** Inbound status update webhook payload from a connected Open311 endpoint. */
export type Open311StatusUpdate = {
  service_request_id: string;
  status: Open311Status;
  status_notes?: string;
  updated_datetime: string;
  agency_responsible?: string;
};

// ---------------------------------------------------------------------------
// Conversion: our record → Open311
// ---------------------------------------------------------------------------

/**
 * Map our internal status to Open311 "open" / "closed".
 * CLOSED, CANCELLED, and DUPLICATE are considered "closed" in Open311.
 */
export function toOpen311Status(internalStatus: string): Open311Status {
  const closed = new Set(["CLOSED", "CANCELLED", "DUPLICATE"]);
  return closed.has(internalStatus) ? "closed" : "open";
}

/**
 * Convert a CallAssistCallRecord to an Open311 GeoReport v2 service request.
 * Fields not available in our model are omitted (optional in the spec).
 */
export function toOpen311ServiceRequest(
  record: CallAssistCallRecord,
  opts?: {
    /** Override the service code from the department mapping below. */
    serviceCode?: string;
    /** Media URL for a photo attached to this SR. */
    mediaUrl?: string;
  },
): Open311ServiceRequest {
  const serviceCode =
    opts?.serviceCode ?? departmentToOpen311ServiceCode(record.department ?? "");
  // Cast to access optional fields that may be present in extended records
  const ext = record as CallAssistCallRecord & {
    issueDescription?: string;
    lat?: number;
    long?: number;
  };
  return {
    service_request_id: record.confirmationNumber,
    status: toOpen311Status(record.status),
    status_notes: latestStatusNote(record),
    service_code: serviceCode,
    description: ext.issueDescription ?? record.incidentType,
    requested_datetime: record.createdAt ?? new Date().toISOString(),
    updated_datetime: record.updatedAt,
    address: record.incidentLocation,
    ...(ext.lat != null && ext.long != null
      ? { lat: ext.lat, long: ext.long }
      : {}),
    ...(opts?.mediaUrl ? { media_url: opts.mediaUrl } : {}),
  };
}

// ---------------------------------------------------------------------------
// Conversion: Open311 inbound → our status update
// ---------------------------------------------------------------------------

export type Open311InboundUpdate = {
  confirmationNumber: string;
  newStatusNote: string;
  open311Status: Open311Status;
  updatedAt: string;
  agencyResponsible?: string;
};

/**
 * Parse an inbound Open311 webhook status update into our internal format.
 */
export function fromOpen311StatusUpdate(update: Open311StatusUpdate): Open311InboundUpdate {
  return {
    confirmationNumber: update.service_request_id,
    newStatusNote: [
      update.status_notes ?? (update.status === "closed" ? "Request marked closed." : "Status updated."),
      update.agency_responsible ? `Handled by: ${update.agency_responsible}` : "",
    ]
      .filter(Boolean)
      .join(" "),
    open311Status: update.status,
    updatedAt: update.updated_datetime,
    agencyResponsible: update.agency_responsible,
  };
}

// ---------------------------------------------------------------------------
// Department → Open311 service code mapping
// ---------------------------------------------------------------------------

const DEPT_TO_OPEN311_CODE: Record<string, string> = {
  PUBLIC_WORKS: "RD-POT",             // Pothole / road damage
  PUBLIC_WORKS_ELECTRICAL: "RD-SIG",  // Signal / streetlight
  SANITATION: "SW-MSS",               // Missed sanitation service
  WATER_SEWER_AUTHORITY: "WT-BRK",    // Water / sewer issue
  CODE_ENFORCEMENT: "CE-VIO",         // Code violation
  PARKING_ENFORCEMENT: "PK-ILL",      // Parking violation
  ANIMAL_CONTROL: "AC-STR",           // Stray / dangerous animal
  URBAN_FORESTRY: "UF-TRE",           // Tree issue
  PARKS_RECREATION: "PR-DAM",         // Park damage
  HOUSING_COMMUNITY_DEV: "HC-VIO",    // Housing violation
  ENVIRONMENTAL_QUALITY: "EQ-DMP",    // Environmental complaint
  POLICE_NON_EMERGENCY: "PE-NON",     // Non-emergency police
  FIRE_MARSHAL_NON_EMERGENCY: "FM-INS", // Fire marshal inspection
  TRANSIT_AUTHORITY: "TR-DAM",        // Transit damage
  CITY_CLERK: "CK-EVT",              // Special event / city clerk
  SOCIAL_SERVICES: "SS-OUT",          // Social services outreach
  THREE11_OPERATIONS: "311-INF",      // 311 information request
  UTILITIES: "UT-SVC",               // Utilities
};

export function departmentToOpen311ServiceCode(department: string): string {
  return DEPT_TO_OPEN311_CODE[department] ?? "311-GEN";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function latestStatusNote(record: CallAssistCallRecord): string | undefined {
  const history = (record as { statusHistory?: Array<{ note?: string }> }).statusHistory;
  if (!history?.length) return undefined;
  return history[history.length - 1]?.note ?? undefined;
}
