/**
 * CentralSquare Enterprise CAD Adapter
 *
 * Connects to CentralSquare Enterprise CAD (Charleston County v21.1.2 Patch 4).
 *
 * STATUS: Live HTTP. Slot stays dark until Secrets Manager has baseUrl + OAuth credentials.
 *
 * TO ACTIVATE: Put JSON at rapid-cortex/c2c/{agencyId}/cad-c (or cad-d)
 *   { "baseUrl", "clientId", "clientSecret", "authTokenUrl", "webhookSecret", "agencyCode" }

 *
 * CONTACT: CentralSquare Open Platform partner program
 *   Product: CentralSquare Enterprise CAD / Open Platform API
 *
 * NOTE: CentralSquare uses OAuth2 client credentials (not API keys).
 *       Token refresh is handled automatically by this adapter.
 *
 * WHAT WE NEED FROM CENTRALSQUARE:
 *   See docs/CENTRALSQUARE_API_SPEC.md for every endpoint needed.
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
  AddressValidationResult,
  AdapterEventHandler,
  UnsubscribeFn,
  CADConnectionError,
  CADAuthError,
} from './adapter.interface.js';
import { CadHttpClient, AdapterDisabledError } from './http-client.js';
import { assertCadWritebackEnabled } from './writeback-gate.js';
import { mapCSIncidentType } from '../common-codes/mappers/centralsquare.js';
import type {
  EidoEnvelope,
  EidoDispatchConfirmation,
  EidoTransferRequest,
  EidoTransferResponse,
  EidoUnitStatusUpdate,
  ISO8601,
} from '../eido/index.js';

// ─── Configuration ────────────────────────────────────────────────────────

export interface CentralSquareConfig {
  agencyId: string;
  agencyName: string;
  /**
   * Base URL for CS Enterprise API.
   * Format: https://{cad-host}/cs-enterprise/api
   */
  baseUrl: string;
  /**
   * OAuth2 client ID.
   * Pulled from Secrets Manager: rapid-cortex/c2c/CHAS-SC/cs/client-id
   */
  clientId: string;
  /**
   * OAuth2 client secret.
   * Pulled from Secrets Manager: rapid-cortex/c2c/CHAS-SC/cs/client-secret
   */
  clientSecret: string;
  /**
   * OAuth2 token endpoint.
   * Format: https://{auth-host}/oauth2/token
   */
  authTokenUrl: string;
  /**
   * CS agency / site code.
   */
  agencyCode: string;
  /**
   * CAD version
   */
  cadVersion: '21.1';
  /**
   * OAuth2 token scopes to request.
   * CS may require: 'incidents:read', 'incidents:write', 'units:read', 'avl:read'
   * CONFIRM WITH CENTRALSQUARE.
   */
  oauthScopes: string[];
  pollIntervalMs: number;
  timeoutMs?: number;
}

// ─── Native CentralSquare Enterprise types ────────────────────────────────
// CentralSquare Enterprise uses different field names from Southern Software.
// These are preliminary — to be confirmed with CS API docs.

interface CSIncident {
  incidentNumber: string;       // CS incident number (e.g., "2026-0001234")
  callTypeCode: string;         // CS call type
  callTypeDescription: string;
  priorityCode: string;         // CS priority (may be numeric or alpha)
  incidentStatus: string;       // CS status
  locationAddress: string;
  locationCity: string;
  locationState: string;
  locationZip?: string;
  locationCounty?: string;
  gisLatitude?: number;
  gisLongitude?: number;
  callerName?: string;
  callerPhone?: string;
  callerANI?: string;
  respondingUnits?: CSUnit[];
  comments?: CSComment[];
  createDateTime: string;
  lastUpdateDateTime: string;
  closeDateTime?: string;
  dispatchDateTime?: string;
  onSceneDateTime?: string;
  psapId?: string;
  esz?: string;
  [key: string]: unknown;
}

interface CSUnit {
  unitId: string;
  unitDescription: string;
  unitType: string;
  currentStatus: string;
  assignedDateTime?: string;
  enRouteDateTime?: string;
  arrivedDateTime?: string;
  clearedDateTime?: string;
  latitude?: number;
  longitude?: number;
}

interface CSComment {
  sequence: number;
  commentText: string;
  commentDateTime: string;
  operatorId: string;
  operatorName?: string;
  sensitive?: boolean;
}

interface CSAVLRecord {
  unitId: string;
  latitude: number;
  longitude: number;
  heading: number;
  speedMph: number;
  avlDateTime: string;
  currentStatus?: string;
}

// ─── OAuth2 Token Manager ─────────────────────────────────────────────────

class OAuth2TokenManager {
  private accessToken: string | null = null;
  private expiresAt: number = 0;

  constructor(
    private readonly tokenUrl: string,
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly scopes: string[],
  ) {}

  async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAt - 60_000) {
      return this.accessToken;
    }
    return this.refresh();
  }

  private async refresh(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: this.scopes.join(' '),
    });
    let res: Response;
    try {
      res = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch {
      throw new CADAuthError('CHAS-SC');
    }
    if (!res.ok) {
      throw new CADAuthError('CHAS-SC');
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) {
      throw new CADAuthError('CHAS-SC');
    }
    this.accessToken = json.access_token;
    this.expiresAt = Date.now() + Math.max(60, json.expires_in ?? 3600) * 1000;
    return this.accessToken;
  }
}

// ─── HTTP Client ─────────────────────────────────────────────────────────

class CentralSquareApiClient {
  private tokenManager: OAuth2TokenManager;
  private readonly http: CadHttpClient;

  constructor(private readonly config: CentralSquareConfig) {
    this.tokenManager = new OAuth2TokenManager(
      config.authTokenUrl,
      config.clientId,
      config.clientSecret,
      config.oauthScopes,
    );
    this.http = new CadHttpClient({
      agencyId: config.agencyId,
      baseUrl: config.baseUrl,
      timeoutMs: config.timeoutMs ?? 10_000,
      headers: () => this.authHeaders(),
    });
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.tokenManager.getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CS-Agency': this.config.agencyCode,
      'X-CS-Version': this.config.cadVersion,
      'User-Agent': 'RapidCortex-C2C-Hub/1.0',
    };
  }

  /**
   * GET /cs-enterprise/api/v1/incidents
   * Query: modifiedAfter, status, limit, offset
   *
   * CONFIRM WITH CENTRALSQUARE:
   * - Exact endpoint path and version prefix
   * - OAuth2 scope required (likely 'incidents:read')
   * - Date filter parameter name (modifiedAfter vs since vs lastModified)
   * - Status code values (may differ from Southern Software)
   * - Pagination mechanism (offset/limit vs cursor)
   */
  async getActiveIncidents(query?: IncidentQuery): Promise<CSIncident[]> {
    const data = await this.http.request<CSIncident[] | { incidents?: CSIncident[] }>('GET', 'v1/incidents', {
      query: {
        modifiedAfter: query?.since,
        status: query?.statuses?.join(',') ?? 'ACTIVE,DISPATCHED',
        limit: query?.limit ? String(query.limit) : undefined,
      },
    });
    return Array.isArray(data) ? data : data.incidents ?? [];
  }

  async getIncidentById(incidentNumber: string): Promise<CSIncident | null> {
    try {
      return await this.http.request<CSIncident>('GET', `v1/incidents/${encodeURIComponent(incidentNumber)}`);
    } catch {
      return null;
    }
  }

  async createIncident(incident: Partial<CSIncident>): Promise<CSIncident> {
    return this.http.request<CSIncident>('POST', 'v1/incidents', { body: incident });
  }

  async updateIncident(incidentNumber: string, update: Partial<CSIncident>): Promise<CSIncident> {
    return this.http.request<CSIncident>('PATCH', `v1/incidents/${encodeURIComponent(incidentNumber)}`, { body: update });
  }

  async closeIncident(incidentNumber: string, dispositionCode?: string): Promise<void> {
    await this.http.request('POST', `v1/incidents/${encodeURIComponent(incidentNumber)}/close`, {
      body: { dispositionCode },
    });
  }

  async recordExternalDispatch(incidentNumber: string, externalAgencyId: string, units: CSUnit[]): Promise<void> {
    await this.http.request('POST', `v1/incidents/${encodeURIComponent(incidentNumber)}/external-update`, {
      body: { updateType: 'DISPATCH_CONFIRMATION', externalAgencyId, respondingUnits: units, timestamp: new Date().toISOString() },
    });
  }

  async getUnits(query?: { status?: string[]; type?: string[] }): Promise<CSUnit[]> {
    const data = await this.http.request<CSUnit[] | { units?: CSUnit[] }>('GET', 'v1/resources', {
      query: { status: query?.status?.join(','), type: query?.type?.join(',') },
    });
    return Array.isArray(data) ? data : data.units ?? [];
  }

  async getAVLPositions(): Promise<CSAVLRecord[]> {
    const data = await this.http.request<CSAVLRecord[] | { positions?: CSAVLRecord[] }>('GET', 'v1/avl/positions');
    return Array.isArray(data) ? data : data.positions ?? [];
  }

  async subscribeToEventStream(callbackUrl: string, events: string[]): Promise<{ subscriptionId: string }> {
    const data = await this.http.request<{ subscriptionId?: string; id?: string }>('POST', 'v1/webhooks', {
      body: { callbackUrl, events },
    });
    return { subscriptionId: data.subscriptionId ?? data.id ?? 'registered' };
  }

  async validateAddress(address: string): Promise<{ valid: boolean; coordinates?: { latitude: number; longitude: number } }> {
    return this.http.request('GET', 'v1/gis/validate-address', { query: { address } });
  }

  async ping(): Promise<{ status: string; version: string }> {
    const data = await this.http.request<{ status?: string; version?: string }>('GET', 'v1/health');
    return { status: data.status ?? 'ok', version: data.version ?? this.config.cadVersion };
  }
}
// ─── EIDO ↔ CS Enterprise Mappers ────────────────────────────────────────

function mapCSToEido(cs: CSIncident, agencyId: string, agencyName: string): EidoEnvelope {
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
      IncidentId: cs.incidentNumber,
      CallType: mapCSCallType(cs.callTypeCode),
      CallTypeDescription: cs.callTypeDescription,
      Priority: mapCSPriority(cs.priorityCode),
      Status: mapCSStatus(cs.incidentStatus),
      Location: {
        Address: {
          FullAddress: cs.locationAddress,
          StreetName: cs.locationAddress,  // TODO: parse when we have CS address format
          City: cs.locationCity,
          State: cs.locationState ?? 'SC',
          PostalCode: cs.locationZip,
          County: cs.locationCounty,
        },
        ...(cs.gisLatitude && cs.gisLongitude ? {
          Coordinates: {
            Latitude: cs.gisLatitude,
            Longitude: cs.gisLongitude,
            DeterminationMethod: 'ADDRESS' as const,
          },
        } : {}),
        ESZ: cs.esz,
      },
      Caller: cs.callerName || cs.callerPhone ? {
        Name: cs.callerName,
        CallbackNumber: cs.callerPhone,
        ANI: cs.callerANI,
      } : undefined,
      Units: cs.respondingUnits?.map(u => ({
        UnitId: u.unitId,
        UnitType: u.unitType,
        AgencyId: agencyId,
        Status: mapCSUnitStatus(u.currentStatus),
        DispatchedAt: u.assignedDateTime,
        EnRouteAt: u.enRouteDateTime,
        OnSceneAt: u.arrivedDateTime,
        ClearedAt: u.clearedDateTime,
        CurrentLocation: u.latitude && u.longitude ? {
          Latitude: u.latitude,
          Longitude: u.longitude,
        } : undefined,
      })),
      Narrative: cs.comments?.map((c, i) => ({
        EntryId: String(c.sequence || i),
        Timestamp: c.commentDateTime,
        AuthorId: c.operatorId,
        AuthorName: c.operatorName ?? c.operatorId,
        AuthorRole: 'DISPATCHER',
        Text: c.commentText,
        LESSensitive: c.sensitive,
      })),
      ReceivedAt: cs.createDateTime,
      DispatchedAt: cs.dispatchDateTime,
      OnSceneAt: cs.onSceneDateTime,
      ClearedAt: cs.closeDateTime,
      UpdatedAt: cs.lastUpdateDateTime,
    },
  };
}

function mapEidoToCS(eido: EidoEnvelope): Partial<CSIncident> {
  const inc = eido.incident;
  return {
    callTypeCode: inc.CallType,  // TODO: reverse-map APCO → CS
    callTypeDescription: inc.CallTypeDescription,
    priorityCode: inc.Priority,
    locationAddress: inc.Location.Address.FullAddress,
    locationCity: inc.Location.Address.City,
    locationState: inc.Location.Address.State,
    locationZip: inc.Location.Address.PostalCode,
    locationCounty: inc.Location.Address.County,
    gisLatitude: inc.Location.Coordinates?.Latitude,
    gisLongitude: inc.Location.Coordinates?.Longitude,
    callerName: inc.Caller?.Name,
    callerPhone: inc.Caller?.CallbackNumber,
    callerANI: inc.Caller?.ANI,
    // Cross-agency metadata — CS must display to dispatcher
    // Field names TBD with CentralSquare
    externalSource: 'RAPID_CORTEX_C2C',
    externalIncidentId: inc.IncidentId,
    externalAgencyName: eido.header.SenderAgencyName,
    externalHubMessageId: eido.header.MessageId,
  };
}

// Priority/status mappers — PRELIMINARY, to be confirmed with CS API docs
function mapCSCallType(csType: string): string {
  return mapCSIncidentType(csType) ?? csType ?? 'OT-UNKNOWN';
}

function mapCSPriority(csPriority: string): '1'|'2'|'3'|'4'|'5' {
  const num = parseInt(csPriority);
  if (num >= 1 && num <= 5) return num.toString() as '1'|'2'|'3'|'4'|'5';
  const map: Record<string, '1'|'2'|'3'|'4'|'5'> = {
    'EMERGENCY': '1', 'URGENT': '2', 'ROUTINE': '3',
  };
  return map[csPriority.toUpperCase()] ?? '3';
}

function mapCSStatus(csStatus: string): any {
  const map: Record<string, string> = {
    'PENDING': 'PENDING', 'ACTIVE': 'ACTIVE',
    'DISPATCHED': 'DISPATCHED', 'CLOSED': 'CLEARED', 'CANCELLED': 'CANCELLED',
  };
  return map[csStatus.toUpperCase()] ?? 'ACTIVE';
}

function mapCSUnitStatus(csStatus: string): any {
  const map: Record<string, string> = {
    'AVAILABLE': 'AVAILABLE', 'DISPATCHED': 'DISPATCHED',
    'EN ROUTE': 'EN_ROUTE', 'ON SCENE': 'ON_SCENE',
    'TRANSPORT': 'TRANSPORT', 'AT HOSPITAL': 'AT_HOSPITAL',
    'CLEARED': 'CLEARED', 'OUT OF SERVICE': 'OUT_OF_SERVICE',
  };
  return map[csStatus.toUpperCase()] ?? csStatus;
}

// ─── The Adapter ──────────────────────────────────────────────────────────

export class CentralSquareAdapter implements ICadAdapter {
  readonly agencyId: string;
  readonly agencyName: string;
  readonly cadSystem = 'CentralSquare Enterprise CAD';

  private client: CentralSquareApiClient;
  private lastPollAt: ISO8601 = new Date(0).toISOString();
  private initialized = false;

  constructor(private readonly config: CentralSquareConfig) {
    this.agencyId = config.agencyId;
    this.agencyName = config.agencyName;
    this.client = new CentralSquareApiClient(config);
  }

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
  }

  async healthCheck(): Promise<AdapterHealthStatus> {
    try {
      await this.client.ping();
      return {
        agencyId: this.agencyId,
        adapterType: 'CENTRALSQUARE',
        cadSystem: this.cadSystem,
        cadVersion: this.config.cadVersion,
        status: 'ONLINE',
        lastSuccessfulContact: new Date().toISOString(),
        activeIncidentCount: 0,
        availableUnitCount: 0,
      };
    } catch {
      return {
        agencyId: this.agencyId,
        adapterType: 'CENTRALSQUARE',
        cadSystem: this.cadSystem,
        cadVersion: this.config.cadVersion,
        status: 'OFFLINE',
        lastSuccessfulContact: this.lastPollAt,
        activeIncidentCount: 0,
        availableUnitCount: 0,
        errorMessage: 'CentralSquare Enterprise API not yet connected — pending OAuth2 credentials',
      };
    }
  }

  async getActiveIncidents(query?: IncidentQuery): Promise<IncidentQueryResult> {
    const csIncidents = await this.client.getActiveIncidents(query);
    const incidents = csIncidents.map(cs => mapCSToEido(cs, this.agencyId, this.agencyName));
    this.lastPollAt = new Date().toISOString();
    return { incidents, hasMore: false };
  }

  async getIncidentById(nativeId: string): Promise<EidoEnvelope | null> {
    const cs = await this.client.getIncidentById(nativeId);
    if (!cs) return null;
    return mapCSToEido(cs, this.agencyId, this.agencyName);
  }

  async createIncident(request: CreateIncidentRequest): Promise<CreateIncidentResult> {
    assertCadWritebackEnabled(this.agencyId, 'createIncident');
    const csPayload = mapEidoToCS(request.eido);
    const created = await this.client.createIncident(csPayload);
    return {
      nativeIncidentId: created.incidentNumber,
      created: true,
      dispatched: false,
      confirmedEido: mapCSToEido(created, this.agencyId, this.agencyName),
    };
  }

  async updateIncident(nativeId: string, update: Partial<EidoEnvelope['incident']>): Promise<void> {
    assertCadWritebackEnabled(this.agencyId, 'updateIncident');
    const csUpdate: Partial<CSIncident> = {};
    if (update.Status) csUpdate.incidentStatus = update.Status;
    await this.client.updateIncident(nativeId, csUpdate);
  }

  async closeIncident(nativeId: string, dispositionCode?: string): Promise<void> {
    assertCadWritebackEnabled(this.agencyId, 'closeIncident');
    await this.client.closeIncident(nativeId, dispositionCode);
  }

  async receiveDispatchConfirmation(confirmation: EidoDispatchConfirmation): Promise<void> {
    assertCadWritebackEnabled(this.agencyId, 'receiveDispatchConfirmation');
    const csUnits: CSUnit[] = confirmation.AssignedUnits.map(u => ({
      unitId: u.UnitId,
      unitDescription: `${u.UnitType} ${u.UnitId}`,
      unitType: u.UnitType,
      currentStatus: u.Status,
      assignedDateTime: u.DispatchedAt,
      enRouteDateTime: u.EnRouteAt,
      arrivedDateTime: u.OnSceneAt,
    }));
    await this.client.recordExternalDispatch(
      confirmation.IncidentId,
      confirmation.ConfirmingAgencyId,
      csUnits,
    );
  }

  async getUnits(query?: UnitQuery): Promise<EidoUnitStatusUpdate[]> {
    const csUnits = await this.client.getUnits({
      status: query?.statuses as string[] | undefined,
      type: query?.unitTypes,
    });
    return csUnits.map(u => ({
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
      NewStatus: mapCSUnitStatus(u.currentStatus) as any,
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
      speedMph: r.speedMph,
      timestamp: r.avlDateTime,
    }));
  }

  async subscribeToEvents(handler: AdapterEventHandler): Promise<UnsubscribeFn> {
    try {
      const { subscriptionId } = await this.client.subscribeToEventStream(
        `${process.env['HUB_WEBHOOK_BASE_URL']}/c2c/inbound/${this.agencyId}`,
        ['incident.created', 'incident.updated', 'unit.status.changed', 'avl.update'],
      );
      console.log(`[${this.agencyId}] CS event stream subscribed: ${subscriptionId}`);
      return () => { /* deregister */ };
    } catch {
      console.warn(`[${this.agencyId}] CS event push not available — using polling`);
      return () => {};
    }
  }

  async validateAddress(address: string): Promise<AddressValidationResult> {
    try {
      const result = await this.client.validateAddress(address);
      return { valid: result.valid, coordinates: result.coordinates };
    } catch {
      return { valid: true, warnings: ['Address validation not available — CS API not connected'] };
    }
  }
}
