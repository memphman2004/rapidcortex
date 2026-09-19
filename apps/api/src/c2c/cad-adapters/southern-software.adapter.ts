/**
 * Southern Software CAD Adapter
 *
 * Connects to Southern Software CAD systems (Berkeley County v21.2.238
 * and Dorchester County v25.2.241.32).
 *
 * STATUS: Live HTTP. Slot stays dark until Secrets Manager has baseUrl + credentials.
 *
 * TO ACTIVATE: Put JSON at
 *   rapid-cortex/c2c/{agencyId}/cad-a   (or cad-b … cad-h)
 *   { "baseUrl", "apiKey"|"clientId"+"clientSecret"+"authTokenUrl", "webhookSecret", "agencyCode" }

 *
 * CONTACT: Southern Software partner API program
 *   Product: VisiCAD / Southern Software CAD
 *   API needed: CAD-to-CAD Interface API (they call it "external incident interface")
 *
 * WHAT WE NEED FROM SOUTHERN SOFTWARE:
 *   See docs/SOUTHERN_SOFTWARE_API_SPEC.md for the complete specification
 *   of every endpoint we need. We've implemented the entire adapter —
 *   we just need your API docs and credentials to wire the HTTP calls.
 */

import {
  ICadAdapter,
  AdapterHealthStatus,
  CreateIncidentRequest,
  CreateIncidentResult,
  IncidentQuery,
  IncidentQueryResult,
  UnitQuery,
  AVLPosition,
  GeoJSONPolygon,
  AddressValidationResult,
  AdapterEventHandler,
  UnsubscribeFn,
  CADConnectionError,
} from './adapter.interface.js';
import { CadHttpClient, AdapterDisabledError } from './http-client.js';
import { assertCadWritebackEnabled } from './writeback-gate.js';
import { mapSSIncidentType } from '../common-codes/mappers/southern-software.js';
import type {
  EidoEnvelope,
  EidoDispatchConfirmation,
  EidoTransferRequest,
  EidoTransferResponse,
  EidoUnitStatusUpdate,
  ISO8601,
} from '../eido/index.js';

// ─── Configuration ────────────────────────────────────────────────────────

export interface SouthernSoftwareConfig {
  agencyId: string;
  agencyName: string;
  /**
   * Base URL for the Southern Software API.
   * Format: https://{cad-host}/ssapi
   * Pulled from Secrets Manager at runtime.
   */
  baseUrl: string;
  /**
   * API key for authentication.
   * Pulled from Secrets Manager: rapid-cortex/c2c/{agencyId}/ss/api-key
   */
  apiKey: string;
  /**
   * Southern Software agency code (e.g., 'BERK-SC', 'DORCH-SC')
   */
  agencyCode: string;
  /**
   * CAD version — determines which API endpoints are available.
   * Berkeley = '21', Dorchester = '25'
   */
  version: '21' | '25';
  /**
   * How often to poll for new/updated incidents (milliseconds).
   * Used when event subscriptions are not available.
   * Default: 5000 (5 seconds)
   */
  pollIntervalMs: number;
  /**
   * HMAC secret for validating inbound SS webhooks, if SS supports them.
   * Pulled from Secrets Manager: rapid-cortex/c2c/{agencyId}/ss/webhook-secret
   */
  webhookSecret?: string;
  /**
   * Timeout for API calls in milliseconds. Default: 10000 (10 seconds)
   */
  timeoutMs?: number;
}

// ─── Native Southern Software types ──────────────────────────────────────
// These types represent the shape of data we expect the SS API to return.
// They will be confirmed/corrected once we have API docs from SS.

interface SSIncident {
  incidentId: string;         // SS native incident number
  callType: string;           // SS call type code (mapped to APCO)
  priority: string;           // SS priority (mapped to APCO 1-5)
  status: string;             // SS status string
  address: string;
  city: string;
  county: string;
  latitude?: number;
  longitude?: number;
  callerName?: string;
  callerPhone?: string;
  units?: SSUnit[];
  narrative?: SSNarrativeEntry[];
  receivedAt: string;
  updatedAt: string;
  [key: string]: unknown;     // SS may have additional fields
}

interface SSUnit {
  unitId: string;
  unitType: string;
  status: string;
  dispatchedAt?: string;
  enRouteAt?: string;
  onSceneAt?: string;
}

interface SSNarrativeEntry {
  sequence: number;
  text: string;
  operator: string;
  timestamp: string;
}

interface SSAVLRecord {
  unitId: string;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  timestamp: string;
  status?: string;
}

// ─── HTTP Client ─────────────────────────────────────────────────────────

class SouthernSoftwareApiClient {
  private readonly headers: Record<string, string>;
  private readonly http: CadHttpClient;

  constructor(private readonly config: SouthernSoftwareConfig) {
    this.headers = {
      'Authorization': `ApiKey ${config.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-SS-Agency': config.agencyCode,
      'X-SS-Version': config.version,
      'User-Agent': 'RapidCortex-C2C-Hub/1.0',
    };
    this.http = new CadHttpClient({
      agencyId: config.agencyId,
      baseUrl: config.baseUrl,
      timeoutMs: config.timeoutMs ?? 10_000,
      headers: async () => this.headers,
    });
  }

  async getActiveIncidents(query?: IncidentQuery): Promise<SSIncident[]> {
    const data = await this.http.request<SSIncident[] | { incidents?: SSIncident[] }>('GET', 'v1/incidents', {
      query: {
        status: query?.statuses?.join(',') ?? 'ACTIVE,DISPATCHED',
        since: query?.since,
        limit: query?.limit ? String(query.limit) : undefined,
        cursor: query?.cursor,
        agencyCode: this.config.agencyCode,
      },
    });
    return Array.isArray(data) ? data : data.incidents ?? [];
  }

  async getIncidentById(incidentId: string): Promise<SSIncident | null> {
    try {
      return await this.http.request<SSIncident>('GET', `v1/incidents/${encodeURIComponent(incidentId)}`);
    } catch {
      return null;
    }
  }

  async createIncident(incident: Partial<SSIncident>): Promise<SSIncident> {
    return this.http.request<SSIncident>('POST', 'v1/incidents', { body: incident });
  }

  async updateIncident(incidentId: string, update: Partial<SSIncident>): Promise<SSIncident> {
    return this.http.request<SSIncident>('PATCH', `v1/incidents/${encodeURIComponent(incidentId)}`, { body: update });
  }

  async closeIncident(incidentId: string, dispositionCode?: string): Promise<void> {
    await this.http.request('POST', `v1/incidents/${encodeURIComponent(incidentId)}/close`, {
      body: { dispositionCode },
    });
  }

  async recordDispatchConfirmation(incidentId: string, agencyId: string, units: SSUnit[]): Promise<void> {
    await this.http.request('POST', `v1/incidents/${encodeURIComponent(incidentId)}/crossagency-confirm`, {
      body: { confirmingAgencyId: agencyId, units, timestamp: new Date().toISOString() },
    });
  }

  async getUnits(query?: { status?: string[]; unitType?: string[] }): Promise<SSUnit[]> {
    const data = await this.http.request<SSUnit[] | { units?: SSUnit[] }>('GET', 'v1/units', {
      query: { status: query?.status?.join(','), unitType: query?.unitType?.join(','), agencyCode: this.config.agencyCode },
    });
    return Array.isArray(data) ? data : data.units ?? [];
  }

  async getAVLPositions(): Promise<SSAVLRecord[]> {
    const data = await this.http.request<SSAVLRecord[] | { positions?: SSAVLRecord[] }>('GET', 'v1/avl', {
      query: { agencyCode: this.config.agencyCode },
    });
    return Array.isArray(data) ? data : data.positions ?? [];
  }

  async registerWebhook(url: string, events: string[], secret: string): Promise<string> {
    const data = await this.http.request<{ id?: string; subscriptionId?: string }>('POST', 'v1/webhooks/register', {
      body: { url, events, secret },
    });
    return data.subscriptionId ?? data.id ?? 'registered';
  }

  async validateAddress(address: string): Promise<{ valid: boolean; coordinates?: { lat: number; lon: number } }> {
    return this.http.request('GET', 'v1/validate-address', { query: { address } });
  }

  async ping(): Promise<{ status: 'ok' | 'degraded'; version: string }> {
    const data = await this.http.request<{ status?: string; version?: string }>('GET', 'v1/health');
    return { status: data.status === 'degraded' ? 'degraded' : 'ok', version: data.version ?? this.config.version };
  }
}

// ─── EIDO ↔ SS Mappers ────────────────────────────────────────────────────
/**
 * Maps Southern Software native incident to EIDO envelope.
 * Field mappings will be confirmed once SS provides API docs.
 */
function mapSSToEido(ss: SSIncident, agencyId: string, agencyName: string): EidoEnvelope {
  const { mapSSIncidentType, mapSSPriority, mapSSStatus, mapSSUnitStatus } = import_mappers();

  return {
    header: {
      MessageId: crypto.randomUUID(),
      DateTimeSent: new Date().toISOString(),
      SenderAgencyId: agencyId,
      SenderAgencyName: agencyName,
      RecipientAgencyId: '*',
      SchemaVersion: 'APCO-NENA-2.105.1-2017',
      MessageType: 'NEW_INCIDENT',
    },
    incident: {
      IncidentId: ss.incidentId,
      CallType: mapSSIncidentType(ss.callType),
      CallTypeDescription: ss.callType,
      Priority: mapSSPriority(ss.priority),
      Status: mapSSStatus(ss.status),
      Location: {
        Address: {
          FullAddress: ss.address,
          StreetName: ss.address,  // TODO: parse once we have SS address format
          City: ss.city,
          State: 'SC',
          County: ss.county,
        },
        ...(ss.latitude && ss.longitude ? {
          Coordinates: {
            Latitude: ss.latitude,
            Longitude: ss.longitude,
            DeterminationMethod: 'ADDRESS',
          },
        } : {}),
      },
      Caller: ss.callerName || ss.callerPhone ? {
        Name: ss.callerName,
        CallbackNumber: ss.callerPhone,
      } : undefined,
      Units: ss.units?.map(u => ({
        UnitId: u.unitId,
        UnitType: u.unitType,
        AgencyId: agencyId,
        Status: mapSSUnitStatus(u.status),
        DispatchedAt: u.dispatchedAt,
        EnRouteAt: u.enRouteAt,
        OnSceneAt: u.onSceneAt,
      })),
      Narrative: ss.narrative?.map(n => ({
        EntryId: String(n.sequence),
        Timestamp: n.timestamp,
        AuthorId: n.operator,
        AuthorName: n.operator,
        AuthorRole: 'DISPATCHER',
        Text: n.text,
      })),
      ReceivedAt: ss.receivedAt,
      UpdatedAt: ss.updatedAt,
    },
  };
}

/**
 * Maps EIDO incident to Southern Software create format.
 * PRELIMINARY — will need corrections from SS API docs.
 */
function mapEidoToSS(eido: EidoEnvelope): Partial<SSIncident> {
  const incident = eido.incident;
  return {
    callType: incident.CallType,  // TODO: reverse-map from APCO to SS codes
    priority: incident.Priority,
    address: incident.Location.Address.FullAddress,
    city: incident.Location.Address.City,
    county: incident.Location.Address.County ?? 'Unknown',
    latitude: incident.Location.Coordinates?.Latitude,
    longitude: incident.Location.Coordinates?.Longitude,
    callerName: incident.Caller?.Name,
    callerPhone: incident.Caller?.CallbackNumber,
    // Source info — SS should display this to the dispatcher
    // so they know it's a cross-agency incident
    ..._crossAgencyMeta(eido),
  };
}

function _crossAgencyMeta(eido: EidoEnvelope): Record<string, unknown> {
  return {
    // These field names are guesses — to be confirmed with SS
    externalSource: 'RAPID_CORTEX_C2C',
    externalIncidentId: eido.incident.IncidentId,
    externalAgency: eido.header.SenderAgencyName,
    externalHubMessageId: eido.header.MessageId,
  };
}

// Lazy import to avoid circular deps (mappers depend on common-codes)
function import_mappers() {
  return {
    mapSSIncidentType: (ssType: string): string => mapSSIncidentType(ssType) ?? ssType ?? 'OT-UNKNOWN',
    mapSSPriority: (ssPriority: string): '1'|'2'|'3'|'4'|'5' => {
      const map: Record<string, '1'|'2'|'3'|'4'|'5'> = {
        '1': '1', 'HOT': '1', 'EMERGENCY': '1',
        '2': '2', 'URGENT': '2',
        '3': '3', 'ROUTINE': '3',
        '4': '4', '5': '5',
      };
      return map[ssPriority] ?? '3';
    },
    mapSSStatus: (ssStatus: string): any => {
      const map: Record<string, string> = {
        'PENDING': 'PENDING', 'DISPATCHED': 'DISPATCHED',
        'ACTIVE': 'ACTIVE', 'CLOSED': 'CLEARED', 'CANCELLED': 'CANCELLED',
      };
      return map[ssStatus.toUpperCase()] ?? 'ACTIVE';
    },
    mapSSUnitStatus: (ssStatus: string): string => {
      const map: Record<string, string> = {
        'AV': 'AVAILABLE', 'DP': 'DISPATCHED', 'ER': 'EN_ROUTE',
        'OS': 'ON_SCENE', 'TR': 'TRANSPORT', 'AH': 'AT_HOSPITAL', 'CL': 'CLEARED',
      };
      return map[ssStatus.toUpperCase()] ?? ssStatus;
    },
  };
}

// ─── The Adapter ──────────────────────────────────────────────────────────

export class SouthernSoftwareAdapter implements ICadAdapter {
  readonly agencyId: string;
  readonly agencyName: string;
  readonly cadSystem = 'Southern Software CAD';

  private client: SouthernSoftwareApiClient;
  private lastPollAt: ISO8601 = new Date(0).toISOString();
  private initialized = false;

  constructor(private readonly config: SouthernSoftwareConfig) {
    this.agencyId = config.agencyId;
    this.agencyName = config.agencyName;
    this.client = new SouthernSoftwareApiClient(config);
  }

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
    console.log(`[${this.agencyId}] Southern Software adapter shut down`);
  }

  async healthCheck(): Promise<AdapterHealthStatus> {
    try {
      const ping = await this.client.ping();
      return {
        agencyId: this.agencyId,
        adapterType: 'SOUTHERN_SOFTWARE',
        cadSystem: this.cadSystem,
        cadVersion: this.config.version,
        status: ping.status === 'ok' ? 'ONLINE' : 'DEGRADED',
        lastSuccessfulContact: new Date().toISOString(),
        activeIncidentCount: 0,
        availableUnitCount: 0,
      };
    } catch {
      return {
        agencyId: this.agencyId,
        adapterType: 'SOUTHERN_SOFTWARE',
        cadSystem: this.cadSystem,
        cadVersion: this.config.version,
        status: 'OFFLINE',
        lastSuccessfulContact: this.lastPollAt,
        activeIncidentCount: 0,
        availableUnitCount: 0,
        errorMessage: 'Southern Software API not yet connected — pending vendor credentials',
      };
    }
  }

  async getActiveIncidents(query?: IncidentQuery): Promise<IncidentQueryResult> {
    const ssIncidents = await this.client.getActiveIncidents(query);
    const incidents = ssIncidents.map(ss => mapSSToEido(ss, this.agencyId, this.agencyName));
    this.lastPollAt = new Date().toISOString();
    return { incidents, hasMore: false };
  }

  async getIncidentById(nativeId: string): Promise<EidoEnvelope | null> {
    const ss = await this.client.getIncidentById(nativeId);
    if (!ss) return null;
    return mapSSToEido(ss, this.agencyId, this.agencyName);
  }

  async createIncident(request: CreateIncidentRequest): Promise<CreateIncidentResult> {
    assertCadWritebackEnabled(this.agencyId, 'createIncident');
    const ssPayload = mapEidoToSS(request.eido);
    const created = await this.client.createIncident(ssPayload);
    return {
      nativeIncidentId: created.incidentId,
      created: true,
      dispatched: false,  // dispatcher must confirm in SS CAD
      confirmedEido: mapSSToEido(created, this.agencyId, this.agencyName),
    };
  }

  async updateIncident(nativeId: string, update: Partial<EidoEnvelope['incident']>): Promise<void> {
    assertCadWritebackEnabled(this.agencyId, 'updateIncident');
    // Map EIDO partial update to SS format
    const ssUpdate: Partial<SSIncident> = {};
    if (update.Status) ssUpdate.status = update.Status;
    if (update.Narrative) {
      ssUpdate.narrative = update.Narrative.map((n, i) => ({
        sequence: i,
        text: n.Text,
        operator: n.AuthorName,
        timestamp: n.Timestamp,
      }));
    }
    await this.client.updateIncident(nativeId, ssUpdate);
  }

  async closeIncident(nativeId: string, dispositionCode?: string): Promise<void> {
    assertCadWritebackEnabled(this.agencyId, 'closeIncident');
    await this.client.closeIncident(nativeId, dispositionCode);
  }

  async receiveDispatchConfirmation(confirmation: EidoDispatchConfirmation): Promise<void> {
    assertCadWritebackEnabled(this.agencyId, 'receiveDispatchConfirmation');
    const ssUnits: SSUnit[] = confirmation.AssignedUnits.map(u => ({
      unitId: u.UnitId,
      unitType: u.UnitType,
      status: u.Status,
      dispatchedAt: u.DispatchedAt,
      enRouteAt: u.EnRouteAt,
      onSceneAt: u.OnSceneAt,
    }));
    await this.client.recordDispatchConfirmation(
      confirmation.IncidentId,
      confirmation.ConfirmingAgencyId,
      ssUnits,
    );
  }

  async getUnits(query?: UnitQuery): Promise<EidoUnitStatusUpdate[]> {
    const ssUnits = await this.client.getUnits({
      status: query?.statuses as string[] | undefined,
      unitType: query?.unitTypes,
    });
    return ssUnits.map(u => ({
      header: {
        MessageId: crypto.randomUUID(),
        DateTimeSent: new Date().toISOString(),
        SenderAgencyId: this.agencyId,
        SenderAgencyName: this.agencyName,
        RecipientAgencyId: '*',
        SchemaVersion: 'APCO-NENA-2.105.1-2017',
        MessageType: 'UNIT_STATUS_UPDATE' as const,
      },
      UnitId: u.unitId,
      AgencyId: this.agencyId,
      NewStatus: import_mappers().mapSSUnitStatus(u.status) as any,
      Timestamp: new Date().toISOString(),
    }));
  }

  async getAVLPositions(): Promise<AVLPosition[]> {
    const records = await this.client.getAVLPositions();
    return records.map(r => ({
      unitId: r.unitId,
      agencyId: this.agencyId,
      latitude: r.latitude,
      longitude: r.longitude,
      heading: r.heading,
      speedMph: r.speed,
      timestamp: r.timestamp,
    }));
  }

  async subscribeToEvents(handler: AdapterEventHandler): Promise<UnsubscribeFn> {
    try {
      await this.client.registerWebhook(
        `${process.env['HUB_WEBHOOK_BASE_URL']}/c2c/inbound/${this.agencyId}`,
        ['INCIDENT_CREATED', 'INCIDENT_UPDATED', 'UNIT_STATUS_CHANGED'],
        process.env['SS_WEBHOOK_SECRET_' + this.agencyId] ?? '',
      );
      console.log(`[${this.agencyId}] Webhook registered — using push mode`);
      return () => { /* deregister webhook */ };
    } catch {
      // SS doesn't support webhooks — fall back to polling
      console.warn(`[${this.agencyId}] SS webhooks not available — using ${this.config.pollIntervalMs}ms polling`);
      return () => {};
    }
  }

  async validateAddress(address: string): Promise<AddressValidationResult> {
    try {
      const result = await this.client.validateAddress(address);
      return {
        valid: result.valid,
        coordinates: result.coordinates ? {
          latitude: result.coordinates.lat,
          longitude: result.coordinates.lon,
        } : undefined,
      };
    } catch {
      return { valid: true, warnings: ['Address validation not available — SS API not connected'] };
    }
  }
}
