/**
 * NENA Emergency Incident Data Object (EIDO)
 * Standard: APCO/NENA 2.105.1-2017 + NENA STA-021
 * Wire format: JSON
 *
 * This is the authoritative EIDO type definition for the Rapid Cortex C2C hub.
 * Every CAD adapter must produce/consume this format.
 */

// ─── Primitives ─────────────────────────────────────────────────────────────

export type ISO8601 = string;         // "2026-09-17T21:03:39Z"
export type UUIDv4 = string;          // "550e8400-e29b-41d4-a716-446655440000"
export type E164Phone = string;       // "+18435551234"
export type WGS84Lat = number;        // -90 to 90
export type WGS84Lon = number;        // -180 to 180

// ─── APCO Common Code References ───────────────────────────────────────────

export type APCOIncidentTypeCode = string;    // From APCO ANS 2.103.2-2019
export type APCODispositionCode = string;     // From APCO ANS 1.111.2-2018
export type APCOUnitStatusCode =
  | 'AVAILABLE'
  | 'DISPATCHED'
  | 'EN_ROUTE'
  | 'ON_SCENE'
  | 'TRANSPORT'
  | 'AT_HOSPITAL'
  | 'CLEARED'
  | 'OUT_OF_SERVICE'
  | 'MEAL_BREAK'
  | 'TRAINING'
  | string;  // agencies may extend with prefix X-

// ─── Message Header ─────────────────────────────────────────────────────────

export interface EidoHeader {
  /** UUID v4 uniquely identifying this message (not the incident) */
  MessageId: UUIDv4;

  /** ISO 8601 timestamp when this message was generated */
  DateTimeSent: ISO8601;

  /** The hub assigns a sequence number per agency stream */
  SequenceNumber?: number;

  /** Agency ID of the sender (hub validates against registry) */
  SenderAgencyId: string;

  /** Human-readable sender name */
  SenderAgencyName: string;

  /** Agency ID of the intended recipient(s); '*' means broadcast */
  RecipientAgencyId: string | '*';

  /** EIDO schema version — always "APCO-NENA-2.105.1-2017" */
  SchemaVersion: 'APCO-NENA-2.105.1-2017';

  /** Hub-assigned message type */
  MessageType: EidoMessageType;

  /** If this is an update, the MessageId of the original create */
  CorrelatesTo?: UUIDv4;

  /** Hub routing timestamp (set by hub, not sender) */
  HubRoutedAt?: ISO8601;

  /** Fields removed by hub redaction engine */
  RedactionManifest?: string[];

  /** Digital signature of the message body (RSA-SHA256) */
  Signature?: string;
}

export type EidoMessageType =
  | 'NEW_INCIDENT'
  | 'INCIDENT_UPDATE'
  | 'INCIDENT_CLOSE'
  | 'TRANSFER_REQUEST'
  | 'TRANSFER_ACCEPT'
  | 'TRANSFER_DECLINE'
  | 'DISPATCH_CONFIRMATION'
  | 'UNIT_STATUS_UPDATE'
  | 'HEARTBEAT'
  | 'HEARTBEAT_ACK'
  | 'AGENCY_ONLINE'
  | 'AGENCY_OFFLINE';

// ─── Location ───────────────────────────────────────────────────────────────

export interface EidoCoordinates {
  Latitude: WGS84Lat;
  Longitude: WGS84Lon;
  /** Altitude in meters MSL — optional */
  Altitude?: number;
  /** Horizontal accuracy radius in meters */
  AccuracyMeters?: number;
  /** Method used to determine location */
  DeterminationMethod?: 'GPS' | 'CELL' | 'WIFI' | 'ADDRESS' | 'MANUAL' | 'ALI';
}

export interface EidoAddress {
  /** Full formatted address string */
  FullAddress: string;
  /** House number */
  Number?: string;
  /** Street pre-directional (N, S, E, W) */
  PreDirectional?: string;
  /** Street name */
  StreetName: string;
  /** Street type (St, Ave, Blvd, etc.) */
  StreetType?: string;
  /** Street post-directional */
  PostDirectional?: string;
  /** Unit/Apt designation */
  Unit?: string;
  /** City / municipality */
  City: string;
  /** 2-letter state code */
  State: string;
  /** 5 or 9 digit ZIP */
  PostalCode?: string;
  /** County */
  County?: string;
  /** Country code (default USA) */
  Country?: string;
  /** Cross street */
  CrossStreet?: string;
  /** Intersection type if applicable */
  IntersectionType?: string;
  /** Place name / common name (e.g. "Walmart Supercenter") */
  CommonPlaceName?: string;
  /** Milepost or highway reference */
  MilePost?: string;
}

export interface EidoLocation {
  /** Primary address */
  Address: EidoAddress;
  /** WGS84 coordinates */
  Coordinates?: EidoCoordinates;
  /** Emergency Service Zone */
  ESZ?: string;
  /** Emergency Service Number */
  ESN?: string;
  /** PSAP ID this location belongs to */
  PSAPId?: string;
  /** Jurisdiction / legal authority */
  Jurisdiction?: string;
  /** County for multi-county dispatch */
  County?: string;
  /** Additional location descriptors (floor, building, gate) */
  LocationDescriptor?: string[];
  /** Previous address (for moved incidents) */
  PreviousAddress?: EidoAddress;
  /** GIS map reference */
  MapReference?: string;
}

// ─── Caller Information ─────────────────────────────────────────────────────

export interface EidoCaller {
  /** Callback number (E.164) */
  CallbackNumber?: E164Phone;
  /** Caller's name */
  Name?: string;
  /** Language spoken */
  Language?: string;
  /** Is caller at the scene? */
  AtScene?: boolean;
  /** Caller relationship to incident */
  Relationship?: 'VICTIM' | 'WITNESS' | 'REPORTING_PARTY' | 'BYSTANDER' | 'UNKNOWN';
  /** TDD/TTY indicator */
  TDD?: boolean;
  /** ANI (Automatic Number Identification) */
  ANI?: E164Phone;
  /** ALI (Automatic Location Identification) source */
  ALISource?: string;
}

// ─── Subject / Involved Parties ─────────────────────────────────────────────

export interface EidoSubject {
  /** Subject ID within this incident */
  SubjectId: string;
  /** Role in incident */
  Role: 'SUSPECT' | 'VICTIM' | 'WITNESS' | 'INVOLVED_PARTY' | 'PATIENT' | 'REPORTING_PARTY';
  Name?: string;
  DOB?: string;               // YYYY-MM-DD
  Age?: number;
  Sex?: 'M' | 'F' | 'U';
  Race?: string;
  Height?: string;            // e.g. "5-11"
  Weight?: number;            // lbs
  HairColor?: string;
  EyeColor?: string;
  Clothing?: string;
  /** Weapons information — CJI field, may be redacted for non-LE */
  Weapons?: string;
  /** Wants/warrants — CJI field, redacted for non-LE */
  WarrantsIndicator?: boolean;
  /** Known criminal history flag — CJI, redacted for non-LE */
  CriminalHistory?: boolean;
  /** Vehicle associated with this subject */
  Vehicle?: EidoVehicle;
  /** Medical conditions relevant to EMS response */
  MedicalConditions?: string[];
  /** Location last seen */
  LastKnownLocation?: EidoCoordinates;
}

export interface EidoVehicle {
  VehicleId?: string;
  Year?: number;
  Make?: string;
  Model?: string;
  Color?: string;
  PlateNumber?: string;
  PlateState?: string;
  VIN?: string;
  Description?: string;
  Direction?: string;   // "northbound on I-26"
}

// ─── Unit Assignment ────────────────────────────────────────────────────────

export interface EidoUnitAssignment {
  /** Unit identifier in the dispatching agency's CAD */
  UnitId: string;
  /** Unit type */
  UnitType: string;    // 'ENGINE', 'MEDIC', 'PATROL', 'RESCUE', 'HAZMAT', etc.
  /** Agency that owns this unit */
  AgencyId: string;
  /** Current status */
  Status: APCOUnitStatusCode;
  /** ISO 8601 time dispatched */
  DispatchedAt?: ISO8601;
  /** ISO 8601 time en route */
  EnRouteAt?: ISO8601;
  /** ISO 8601 time on scene */
  OnSceneAt?: ISO8601;
  /** ISO 8601 time cleared */
  ClearedAt?: ISO8601;
  /** Current AVL position */
  CurrentLocation?: EidoCoordinates;
  /** Estimated time of arrival (minutes) */
  ETAMinutes?: number;
  /** Number of personnel on this unit */
  PersonnelCount?: number;
  /** Radio talk group */
  TalkGroup?: string;
}

// ─── Incident Narrative ─────────────────────────────────────────────────────

export interface EidoNarrativeEntry {
  EntryId: string;
  Timestamp: ISO8601;
  AuthorId: string;
  AuthorName: string;
  /** 'DISPATCHER', 'SYSTEM', 'SUPERVISOR', 'UNIT' */
  AuthorRole: string;
  Text: string;
  /** If true, this entry is law-enforcement sensitive — redact for non-LE */
  LESSensitive?: boolean;
}

// ─── The Incident ───────────────────────────────────────────────────────────

export type IncidentPriority = '1' | '2' | '3' | '4' | '5';   // 1 = highest
export type IncidentStatus =
  | 'PENDING'
  | 'DISPATCHED'
  | 'ACTIVE'
  | 'ON_SCENE'
  | 'CLEARED'
  | 'CANCELLED'
  | 'DUPLICATE'
  | 'TRANSFERRED';

export interface EidoIncident {
  /** Originating agency's CAD incident number */
  IncidentId: string;
  /** Hub-assigned cross-agency incident correlator */
  HubIncidentId?: string;

  /** APCO ANS 2.103.2-2019 incident type code */
  CallType: APCOIncidentTypeCode;
  /** Human-readable type description */
  CallTypeDescription: string;

  /** Incident priority (1=highest) */
  Priority: IncidentPriority;

  /** Current status */
  Status: IncidentStatus;

  /** Incident location */
  Location: EidoLocation;

  /** ISO 8601 time received */
  ReceivedAt: ISO8601;
  /** ISO 8601 time first dispatched */
  DispatchedAt?: ISO8601;
  /** ISO 8601 time first unit on scene */
  OnSceneAt?: ISO8601;
  /** ISO 8601 time cleared */
  ClearedAt?: ISO8601;
  /** ISO 8601 most recent update */
  UpdatedAt: ISO8601;

  /** Caller information */
  Caller?: EidoCaller;

  /** Subjects / involved parties */
  Subjects?: EidoSubject[];

  /** Unit assignments */
  Units?: EidoUnitAssignment[];

  /** Narrative entries */
  Narrative?: EidoNarrativeEntry[];

  /** Final disposition code (APCO ANS 1.111.2-2018) */
  Disposition?: APCODispositionCode;
  /** Disposition description */
  DispositionDescription?: string;

  /** Agency-specific extended data (opaque, passed through) */
  ExtendedData?: Record<string, unknown>;

  /** Mutual aid / auto-aid indicator */
  MutualAid?: boolean;
  /** Originating jurisdiction */
  OriginatingJurisdiction?: string;
  /** If transferred, the agency it was transferred from */
  TransferredFrom?: string;

  /** Law-enforcement specific notes — redacted for non-LE */
  LESpecificNotes?: string;
}

// ─── Top-level EIDO Envelope ────────────────────────────────────────────────

export interface EidoEnvelope {
  header: EidoHeader;
  incident: EidoIncident;
}

// ─── Update / Diff Types ────────────────────────────────────────────────────

export interface EidoFieldChange {
  field: string;     // dot-path, e.g. "incident.Status"
  oldValue: unknown;
  newValue: unknown;
}

export interface EidoDiff {
  previousMessageId: UUIDv4;
  changes: EidoFieldChange[];
  /** Only the changed fields — used for incremental updates (section 4.4) */
  patch: Partial<EidoIncident>;
}

// ─── Transfer Types ─────────────────────────────────────────────────────────

export interface EidoTransferRequest {
  header: EidoHeader;   // MessageType: 'TRANSFER_REQUEST'
  incident: EidoIncident;
  transfer: {
    TargetAgencyId: string;
    Reason: TransferReason;
    Notes?: string;
    RequestedResourceType?: string;   // 'EMS', 'FIRE', 'LAW'
    AutoDispatch: boolean;
    RequiresAcknowledgment: boolean;
    ExpiresAt?: ISO8601;
  };
}

export type TransferReason =
  | 'JURISDICTION_BOUNDARY'
  | 'MUTUAL_AID'
  | 'AUTOMATIC_AID'
  | 'RESOURCE_REQUEST'
  | 'TRANSFER_OF_COMMAND'
  | 'ESCALATION'
  | 'PATIENT_TRANSPORT';

export interface EidoTransferResponse {
  header: EidoHeader;   // MessageType: 'TRANSFER_ACCEPT' | 'TRANSFER_DECLINE'
  TransferRequestMessageId: UUIDv4;
  Response: 'ACCEPT' | 'DECLINE';
  Reason?: string;
  /** If accepted and auto-dispatch, the assigned units */
  AssignedUnits?: EidoUnitAssignment[];
  /** Estimated time of first unit on scene (minutes) */
  EstimatedResponseMinutes?: number;
}

export interface EidoDispatchConfirmation {
  header: EidoHeader;   // MessageType: 'DISPATCH_CONFIRMATION'
  TransferRequestMessageId: UUIDv4;
  IncidentId: string;
  ConfirmingAgencyId: string;
  ConfirmedAt: ISO8601;
  AssignedUnits: EidoUnitAssignment[];
}

// ─── Unit Status Update ─────────────────────────────────────────────────────

export interface EidoUnitStatusUpdate {
  header: EidoHeader;   // MessageType: 'UNIT_STATUS_UPDATE'
  UnitId: string;
  AgencyId: string;
  NewStatus: APCOUnitStatusCode;
  Timestamp: ISO8601;
  Location?: EidoCoordinates;
  IncidentId?: string;   // if status change is related to an incident
  Notes?: string;
}

// ─── Heartbeat ───────────────────────────────────────────────────────────────

export interface EidoHeartbeat {
  header: EidoHeader;   // MessageType: 'HEARTBEAT' | 'HEARTBEAT_ACK'
  AgencyId: string;
  Timestamp: ISO8601;
  /** Hub version — included in HEARTBEAT */
  HubVersion?: string;
  /** Adapter version — included in HEARTBEAT from agency */
  AdapterVersion?: string;
  /** CAD system info — included in agency HEARTBEAT */
  CADSystem?: string;
  CADVersion?: string;
  /** Active incident count — status summary */
  ActiveIncidentCount?: number;
  AvailableUnitCount?: number;
}

// ─── NIEM 4.1 Wrapper ───────────────────────────────────────────────────────

export interface NIEMEnvelope<T> {
  'nc:Message': {
    'nc:MessageID': string;
    'nc:MessageDateTime': ISO8601;
    'nc:MessageSubmittalOrganization': {
      'nc:OrganizationIdentification': {
        'nc:IdentificationID': string;
      };
    };
    'em:MessageContent': T;
  };
}

// ─── Result type (no exceptions from validation) ────────────────────────────

export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export interface ValidationError {
  field: string;
  message: string;
  code: 'REQUIRED' | 'INVALID_FORMAT' | 'OUT_OF_RANGE' | 'UNKNOWN_CODE' | 'BUSINESS_RULE';
}

// ─── Raw CAD incident (before EIDO conversion) ─────────────────────────────

/**
 * The raw incident type from any CAD system before conversion to EIDO.
 * Adapters receive this from their CAD and must convert it to EidoEnvelope.
 */
export interface RawCADIncident {
  /** Native CAD incident number */
  nativeId: string;
  /** Source adapter/agency */
  sourceAgencyId: string;
  /** The adapter that produced this record */
  adapterType: 'SOUTHERN_SOFTWARE' | 'CENTRALSQUARE' | 'MOCK' | string;
  /** Raw data blob from the CAD system — adapter-specific shape */
  rawData: Record<string, unknown>;
  /** ISO 8601 when the adapter fetched this record */
  fetchedAt: ISO8601;
}
