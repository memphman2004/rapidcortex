/**
 * ICadAdapter — The Rapid Cortex C2C CAD Adapter Interface
 *
 * This interface defines exactly what the Rapid Cortex hub needs from any
 * CAD system to participate in bidirectional CAD-to-CAD data exchange.
 *
 * VENDOR IMPLEMENTATION GUIDE:
 *
 * Southern Software: implement SouthernSoftwareAdapter (see southern-software.adapter.ts)
 * CentralSquare Enterprise: implement CentralSquareAdapter (see centralsquare.adapter.ts)
 *
 * To connect your CAD to the Rapid Cortex C2C hub, implement every method
 * in this interface. Methods marked REQUIRED must be implemented for basic
 * operation. Methods marked OPTIONAL enhance functionality.
 *
 * Contact: api@rapidcortex.com for integration support.
 */

import type {
  EidoEnvelope,
  EidoDispatchConfirmation,
  EidoTransferRequest,
  EidoTransferResponse,
  EidoUnitStatusUpdate,
  EidoHeartbeat,
  ISO8601,
  APCOUnitStatusCode,
} from '../eido/index.js';

// ─── Health / Status ─────────────────────────────────────────────────────────

export interface AdapterHealthStatus {
  agencyId: string;
  adapterType: string;
  cadSystem: string;
  cadVersion: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';
  latencyMs?: number;
  lastSuccessfulContact: ISO8601;
  activeIncidentCount: number;
  availableUnitCount: number;
  errorMessage?: string;
}

// ─── Query types ─────────────────────────────────────────────────────────────

export interface IncidentQuery {
  /** Return incidents updated since this time */
  since?: ISO8601;
  /** Return incidents with these statuses */
  statuses?: string[];
  /** Maximum number of results */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
}

export interface UnitQuery {
  /** Filter by status */
  statuses?: APCOUnitStatusCode[];
  /** Filter by unit type */
  unitTypes?: string[];
  /** Filter by incident assignment */
  incidentId?: string;
}

export interface IncidentQueryResult {
  incidents: EidoEnvelope[];
  hasMore: boolean;
  nextCursor?: string;
  totalCount?: number;
}

// ─── Create / Update requests ─────────────────────────────────────────────

export interface CreateIncidentRequest {
  /** The EIDO-formatted incident to create in this CAD */
  eido: EidoEnvelope;
  /** Whether to auto-dispatch best available unit */
  autoDispatch: boolean;
  /** Transfer request that originated this create */
  transferRequestMessageId?: string;
  /** Additional instructions for the receiving dispatcher */
  dispatcherNotes?: string;
}

export interface CreateIncidentResult {
  /** The native CAD incident ID assigned by this CAD system */
  nativeIncidentId: string;
  /** Whether the incident was successfully created */
  created: boolean;
  /** Whether a unit was auto-dispatched */
  dispatched: boolean;
  /** Units assigned if dispatched */
  assignedUnits?: EidoUnitStatusUpdate[];
  /** Any warnings from the CAD (e.g., "address not found in GIS, mapped to nearest road") */
  warnings?: string[];
  /** The full EIDO as it appears in this CAD (may differ from input due to CAD normalization) */
  confirmedEido?: EidoEnvelope;
}

// ─── Event subscription ───────────────────────────────────────────────────

export type AdapterEventType =
  | 'INCIDENT_CREATED'
  | 'INCIDENT_UPDATED'
  | 'INCIDENT_CLOSED'
  | 'UNIT_STATUS_CHANGED'
  | 'AVL_UPDATE'
  | 'DISPATCH_CONFIRMED';

export interface AdapterEvent {
  type: AdapterEventType;
  agencyId: string;
  timestamp: ISO8601;
  eido?: EidoEnvelope;
  unitUpdate?: EidoUnitStatusUpdate;
}

export type AdapterEventHandler = (event: AdapterEvent) => Promise<void>;
export type UnsubscribeFn = () => void;

// ─── The Interface ────────────────────────────────────────────────────────

export interface ICadAdapter {
  /**
   * Unique identifier for this agency in the hub.
   * Must match the agencyId in the hub registry.
   */
  readonly agencyId: string;

  /**
   * Human-readable name for this agency.
   */
  readonly agencyName: string;

  /**
   * The CAD system type this adapter connects to.
   */
  readonly cadSystem: string;

  // ── Lifecycle ──────────────────────────────────────────────────────────

  /**
   * REQUIRED. Initialize the adapter: establish connection to the CAD system,
   * validate credentials, verify API version compatibility.
   * Called once when the agency bridge Lambda starts.
   * Should throw if the CAD system is unreachable or credentials are invalid.
   */
  initialize(): Promise<void>;

  /**
   * REQUIRED. Gracefully shut down the adapter. Close connections, flush
   * queued messages, deregister webhooks.
   */
  shutdown(): Promise<void>;

  /**
   * REQUIRED. Return current health status. Called every 30 seconds by the
   * hub heartbeat monitor. Must respond within 5 seconds.
   */
  healthCheck(): Promise<AdapterHealthStatus>;

  // ── Incident Read (Hub pulls from CAD) ────────────────────────────────

  /**
   * REQUIRED. Return all active incidents since the given time.
   * Used by the hub poller to detect new and updated incidents.
   *
   * VENDOR NOTE — Southern Software:
   *   We need: GET /ssapi/v1/incidents?status=ACTIVE,DISPATCHED&since={ISO8601}
   *   Returns: array of incident objects that we convert to EIDO.
   *
   * VENDOR NOTE — CentralSquare Enterprise:
   *   We need: GET /cs-enterprise/api/v1/incidents?modifiedAfter={ISO8601}
   *   Returns: array of incident objects with full CAD data.
   */
  getActiveIncidents(query?: IncidentQuery): Promise<IncidentQueryResult>;

  /**
   * REQUIRED. Return a single incident by its native CAD ID.
   *
   * VENDOR NOTE: This is called when the hub needs fresh data for a specific
   * incident, e.g., after receiving a webhook notification.
   */
  getIncidentById(nativeIncidentId: string): Promise<EidoEnvelope | null>;

  // ── Incident Write (Hub pushes to CAD) ───────────────────────────────

  /**
   * REQUIRED. Create a new incident in this CAD system from an EIDO envelope.
   * This is the core of CAD-to-CAD: the hub sends an incident from Agency A
   * and this method creates it in Agency B's CAD so their dispatchers can see it.
   *
   * VENDOR NOTE — Southern Software:
   *   We need: POST /ssapi/v1/incidents
   *   Body: mapped from EIDO to SS incident format
   *   Must create a "pending" incident that appears in the dispatcher queue.
   *
   * VENDOR NOTE — CentralSquare Enterprise:
   *   We need: POST /cs-enterprise/api/v1/incidents
   *   CS uses different field names — see our field mapping in centralsquare.adapter.ts
   */
  createIncident(request: CreateIncidentRequest): Promise<CreateIncidentResult>;

  /**
   * REQUIRED. Update an existing cross-agency incident in this CAD.
   * Called when the originating agency updates an incident that was
   * previously transferred here.
   *
   * VENDOR NOTE: Must update only the specified fields (patch semantics).
   * The nativeIncidentId is the ID returned by createIncident().
   */
  updateIncident(
    nativeIncidentId: string,
    update: Partial<EidoEnvelope['incident']>,
  ): Promise<void>;

  /**
   * REQUIRED. Mark a cross-agency incident as closed/cleared in this CAD.
   */
  closeIncident(nativeIncidentId: string, dispositionCode?: string): Promise<void>;

  // ── Transfer Flow ─────────────────────────────────────────────────────

  /**
   * OPTIONAL but strongly recommended. Receive a transfer request from the hub.
   * If implemented, shows the dispatcher a confirmation dialog before auto-dispatch.
   * If not implemented, hub falls back to createIncident() directly.
   *
   * VENDOR NOTE: This is what enables the "dispatcher approves transfer" workflow
   * in section 4.2.3 of the RFP. The dispatcher sees a pending incident and
   * clicks Accept/Decline.
   */
  receiveTransferRequest?(request: EidoTransferRequest): Promise<EidoTransferResponse>;

  /**
   * REQUIRED. Receive a dispatch confirmation from another agency.
   * Updates the originating CAD that the secondary agency has dispatched units.
   *
   * VENDOR NOTE — Southern Software:
   *   We need: PUT /ssapi/v1/incidents/{id}/crossagency-confirmation
   *   Body: { confirmedBy: agencyId, units: [...], timestamp: ISO8601 }
   *
   * VENDOR NOTE — CentralSquare Enterprise:
   *   CS likely handles this via a CAD event / notification endpoint.
   */
  receiveDispatchConfirmation(confirmation: EidoDispatchConfirmation): Promise<void>;

  // ── Units ─────────────────────────────────────────────────────────────

  /**
   * REQUIRED. Return current unit roster for this agency.
   * Called at startup and whenever the hub needs to refresh unit data.
   *
   * VENDOR NOTE — Southern Software:
   *   We need: GET /ssapi/v1/units
   *   Returns: array of units with current status and type.
   *
   * VENDOR NOTE — CentralSquare Enterprise:
   *   We need: GET /cs-enterprise/api/v1/resources
   */
  getUnits(query?: UnitQuery): Promise<EidoUnitStatusUpdate[]>;

  /**
   * REQUIRED. Return current AVL (Automatic Vehicle Location) positions.
   * Called every 5-30 seconds by the AVL sync Lambda.
   *
   * VENDOR NOTE — Southern Software:
   *   We need: GET /ssapi/v1/avl
   *   Returns: array of { unitId, lat, lon, heading, speed, timestamp }
   *
   * VENDOR NOTE — CentralSquare Enterprise:
   *   We need: GET /cs-enterprise/api/v1/avl/positions
   */
  getAVLPositions(): Promise<AVLPosition[]>;

  // ── Event Subscription (CAD pushes to Hub) ───────────────────────────

  /**
   * OPTIONAL but strongly preferred. Subscribe to real-time events from the CAD.
   * If the CAD supports webhooks or a push mechanism, implement this to get
   * sub-second latency instead of polling every 5 seconds.
   *
   * Returns an unsubscribe function. Hub calls unsubscribe() on shutdown.
   *
   * VENDOR NOTE — Southern Software:
   *   If SS supports outbound webhooks, configure them to POST to our
   *   agency bridge endpoint. We'll provide the endpoint URL and HMAC secret.
   *
   * VENDOR NOTE — CentralSquare Enterprise:
   *   CS Enterprise has a message bus / event stream. We need credentials
   *   and the topic names for: incident creates, incident updates, unit status.
   */
  subscribeToEvents?(handler: AdapterEventHandler): Promise<UnsubscribeFn>;

  // ── GIS / Map ─────────────────────────────────────────────────────────

  /**
   * OPTIONAL. Return the GeoJSON boundary for this agency's primary jurisdiction.
   * Used by the transfer rules engine for geographic condition evaluation.
   * If not implemented, hub uses statically configured county boundaries.
   */
  getJurisdictionBoundary?(): Promise<GeoJSONPolygon>;

  /**
   * OPTIONAL. Validate that an address is in this agency's response area.
   * Used before creating a cross-agency incident.
   */
  validateAddress?(address: string): Promise<AddressValidationResult>;
}

// ─── Supporting types for the interface ─────────────────────────────────────

export interface AVLPosition {
  unitId: string;
  agencyId: string;
  latitude: number;
  longitude: number;
  heading: number;
  speedMph: number;
  timestamp: ISO8601;
  status?: APCOUnitStatusCode;
}

export interface GeoJSONPolygon {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][];
}

export interface AddressValidationResult {
  valid: boolean;
  normalizedAddress?: string;
  coordinates?: { latitude: number; longitude: number };
  ESZ?: string;
  ESN?: string;
  jurisdictionCode?: string;
  warnings?: string[];
}

// ─── Adapter registry ────────────────────────────────────────────────────────

/**
 * All adapters registered with the hub are accessed through this registry.
 * The hub uses this to route messages to the correct CAD system.
 */
export interface IAdapterRegistry {
  register(adapter: ICadAdapter): void;
  get(agencyId: string): ICadAdapter | undefined;
  getAll(): ICadAdapter[];
  has(agencyId: string): boolean;
  remove(agencyId: string): void;
}

// ─── Error types ─────────────────────────────────────────────────────────────

export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly agencyId: string,
    public readonly method: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

export class NotImplementedError extends AdapterError {
  constructor(agencyId: string, method: string, vendorNote: string) {
    super(
      `[${agencyId}] ${method}() not yet implemented — requires live CAD API credentials.\n${vendorNote}`,
      agencyId,
      method,
    );
    this.name = 'NotImplementedError';
  }
}

export class CADConnectionError extends AdapterError {
  constructor(agencyId: string, method: string, cause: Error) {
    super(`[${agencyId}] ${method}() failed to connect to CAD system`, agencyId, method, cause);
    this.name = 'CADConnectionError';
  }
}

export class CADAuthError extends AdapterError {
  constructor(agencyId: string) {
    super(`[${agencyId}] CAD API authentication failed — check credentials in Secrets Manager`, agencyId, 'auth');
    this.name = 'CADAuthError';
  }
}
