/**
 * Generic REST CAD adapter for all 8 hub slots.
 * Makes real HTTP calls when the slot secret contains baseUrl + credentials.
 * Slot stays dark (health OFFLINE, no poll, webhook no-op) until that secret exists.
 * Partner CAD writes remain fail-closed via assertCadWritebackEnabled.
 */

import type { CADVendor } from "rapid-cortex-shared";
import { resolvePlainOrSecretArn } from "../../lib/runtimeSecrets.js";
import type {
  EidoDispatchConfirmation,
  EidoEnvelope,
  EidoUnitStatusUpdate,
  ISO8601,
} from "../eido/index.js";
import { EidoBuilder } from "../eido/builder.js";
import type {
  AdapterHealthStatus,
  AddressValidationResult,
  AVLPosition,
  CreateIncidentRequest,
  CreateIncidentResult,
  ICadAdapter,
  IncidentQuery,
  IncidentQueryResult,
  UnitQuery,
} from "./adapter.interface.js";
import { AdapterError, CADConnectionError } from "./adapter.interface.js";
import { CadHttpClient, AdapterDisabledError } from "./http-client.js";
import { assertCadWritebackEnabled } from "./writeback-gate.js";
import type { C2cSlotRecord } from "../slots.js";

export interface VendorEndpoints {
  incidents: string;
  incidentById: string;
  createIncident: string;
  updateIncident: string;
  closeIncident: string;
  confirmDispatch: string;
  units: string;
  avl: string;
  health: string;
}

const ENDPOINTS: Record<string, VendorEndpoints> = {
  SOUTHERN_SOFTWARE: {
    incidents: "v1/incidents",
    incidentById: "v1/incidents/{id}",
    createIncident: "v1/incidents",
    updateIncident: "v1/incidents/{id}",
    closeIncident: "v1/incidents/{id}/close",
    confirmDispatch: "v1/incidents/{id}/crossagency-confirm",
    units: "v1/units",
    avl: "v1/avl",
    health: "v1/health",
  },
  CENTRALSQUARE: {
    incidents: "v1/incidents",
    incidentById: "v1/incidents/{id}",
    createIncident: "v1/incidents",
    updateIncident: "v1/incidents/{id}",
    closeIncident: "v1/incidents/{id}/close",
    confirmDispatch: "v1/incidents/{id}/external-update",
    units: "v1/resources",
    avl: "v1/avl/positions",
    health: "v1/health",
  },
  MOTOROLA: {
    incidents: "cad/api/v1/incidents",
    incidentById: "cad/api/v1/incidents/{id}",
    createIncident: "cad/api/v1/incidents",
    updateIncident: "cad/api/v1/incidents/{id}",
    closeIncident: "cad/api/v1/incidents/{id}/close",
    confirmDispatch: "cad/api/v1/incidents/{id}/external",
    units: "cad/api/v1/units",
    avl: "cad/api/v1/avl",
    health: "cad/api/v1/health",
  },
  TYLER: {
    incidents: "api/calls",
    incidentById: "api/calls/{id}",
    createIncident: "api/calls",
    updateIncident: "api/calls/{id}",
    closeIncident: "api/calls/{id}/close",
    confirmDispatch: "api/calls/{id}/notes",
    units: "api/units",
    avl: "api/avl",
    health: "api/health",
  },
  HEXAGON: {
    incidents: "api/incidents",
    incidentById: "api/incidents/{id}",
    createIncident: "api/incidents",
    updateIncident: "api/incidents/{id}",
    closeIncident: "api/incidents/{id}/close",
    confirmDispatch: "api/incidents/{id}/external",
    units: "api/units",
    avl: "api/avl",
    health: "api/health",
  },
  SPILLMAN: {
    incidents: "api/incidents",
    incidentById: "api/incidents/{id}",
    createIncident: "api/incidents",
    updateIncident: "api/incidents/{id}",
    closeIncident: "api/incidents/{id}/close",
    confirmDispatch: "api/incidents/{id}/external",
    units: "api/units",
    avl: "api/avl",
    health: "api/health",
  },
};

function endpointsFor(vendor: CADVendor): VendorEndpoints {
  return ENDPOINTS[vendor] ?? {
    incidents: "api/incidents",
    incidentById: "api/incidents/{id}",
    createIncident: "api/incidents",
    updateIncident: "api/incidents/{id}",
    closeIncident: "api/incidents/{id}/close",
    confirmDispatch: "api/incidents/{id}/external",
    units: "api/units",
    avl: "api/avl",
    health: "api/health",
  };
}

function withId(template: string, id: string): string {
  return template.replace("{id}", encodeURIComponent(id));
}

export interface SlotCredentials {
  baseUrl: string;
  apiKey: string;
  clientId: string;
  clientSecret: string;
  authTokenUrl: string;
  webhookSecret: string;
  agencyCode: string;
}

export async function loadSlotCredentials(slot: C2cSlotRecord): Promise<SlotCredentials> {
  const empty: SlotCredentials = {
    baseUrl: slot.baseUrl?.trim() ?? "",
    apiKey: "",
    clientId: "",
    clientSecret: "",
    authTokenUrl: "",
    webhookSecret: "",
    agencyCode: "",
  };
  const arn = slot.credentialsSecretArn?.trim();
  if (!arn) return empty;
  try {
    const apiKey = await resolvePlainOrSecretArn("", arn, { preferredField: "apiKey" });
    const baseUrl =
      (await resolvePlainOrSecretArn("", arn, { preferredField: "baseUrl" })) || empty.baseUrl;
    const clientId = await resolvePlainOrSecretArn("", arn, { preferredField: "clientId" });
    const clientSecret = await resolvePlainOrSecretArn("", arn, { preferredField: "clientSecret" });
    const authTokenUrl = await resolvePlainOrSecretArn("", arn, { preferredField: "authTokenUrl" });
    const webhookSecret = await resolvePlainOrSecretArn("", arn, { preferredField: "webhookSecret" });
    const agencyCode = await resolvePlainOrSecretArn("", arn, { preferredField: "agencyCode" });
    return {
      baseUrl: baseUrl || empty.baseUrl,
      apiKey,
      clientId,
      clientSecret,
      authTokenUrl,
      webhookSecret,
      agencyCode,
    };
  } catch {
    return empty;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function firstString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return "";
}

export class GenericRestCadAdapter implements ICadAdapter {
  readonly agencyId: string;
  readonly agencyName: string;
  readonly cadSystem: string;
  readonly slot: C2cSlotRecord;

  private client: CadHttpClient | null = null;
  private creds: SlotCredentials | null = null;
  private lastPollAt: ISO8601 = new Date(0).toISOString();
  private initialized = false;
  private oauthToken: string | null = null;
  private oauthExpiresAt = 0;
  private readonly inlineCreds?: Partial<SlotCredentials>;

  constructor(
    private readonly tenantAgencyId: string,
    slot: C2cSlotRecord,
    inlineCreds?: Partial<SlotCredentials>,
  ) {
    this.slot = slot;
    this.agencyId = `${tenantAgencyId}:${slot.slot}`;
    this.agencyName = slot.label;
    this.cadSystem = slot.vendor;
    this.inlineCreds = inlineCreds;
  }

  private paths(): VendorEndpoints {
    return endpointsFor(this.slot.vendor);
  }

  async initialize(): Promise<void> {
    const loaded = await loadSlotCredentials(this.slot);
    this.creds = {
      ...loaded,
      ...Object.fromEntries(
        Object.entries(this.inlineCreds ?? {}).filter(([, v]) => typeof v === "string" && v.trim()),
      ),
    } as SlotCredentials;
    const timeoutMs = 10_000;
    this.client = new CadHttpClient({
      agencyId: this.agencyId,
      baseUrl: this.creds.baseUrl,
      timeoutMs,
      headers: () => this.authHeaders(),
    });
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
  }

  async healthCheck(): Promise<AdapterHealthStatus> {
    const base: AdapterHealthStatus = {
      agencyId: this.agencyId,
      adapterType: this.slot.vendor,
      cadSystem: this.cadSystem,
      cadVersion: "live-http",
      status: "OFFLINE",
      lastSuccessfulContact: this.lastPollAt,
      activeIncidentCount: 0,
      availableUnitCount: 0,
    };
    if (!this.slot.enabled) {
      return { ...base, errorMessage: "Slot switched off" };
    }
    if (!this.client?.ready) {
      return {
        ...base,
        status: "UNKNOWN",
        errorMessage: `Waiting for secret ${this.slot.credentialsSecretArn} (baseUrl + apiKey or OAuth client)`,
      };
    }
    try {
      await this.client.request("GET", this.paths().health);
      this.lastPollAt = new Date().toISOString();
      return { ...base, status: "ONLINE", lastSuccessfulContact: this.lastPollAt };
    } catch (err) {
      return {
        ...base,
        status: "DEGRADED",
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getActiveIncidents(query?: IncidentQuery): Promise<IncidentQueryResult> {
    if (!this.slot.enabled || !this.slot.inboundEnabled) return { incidents: [], hasMore: false };
    if (!this.client?.ready) return { incidents: [], hasMore: false };
    const data = await this.requireClient().request<unknown>("GET", this.paths().incidents, {
      query: {
        since: query?.since,
        modifiedAfter: query?.since,
        status: query?.statuses?.join(","),
        limit: query?.limit ? String(query.limit) : undefined,
        cursor: query?.cursor,
      },
    });
    this.lastPollAt = new Date().toISOString();
    const rows = Array.isArray(data) ? data : ((asRecord(data).incidents as unknown[]) ?? []);
    const incidents = rows.map((row) => this.toEido(asRecord(row)));
    return { incidents, hasMore: false, totalCount: incidents.length };
  }

  async getIncidentById(nativeIncidentId: string): Promise<EidoEnvelope | null> {
    if (!this.client?.ready) return null;
    try {
      const row = await this.requireClient().request<unknown>("GET", withId(this.paths().incidentById, nativeIncidentId));
      if (!row) return null;
      return this.toEido(asRecord(row));
    } catch {
      return null;
    }
  }

  async createIncident(request: CreateIncidentRequest): Promise<CreateIncidentResult> {
    if (!this.slot.enabled || !this.slot.outboundEnabled) {
      throw new AdapterDisabledError(this.agencyId, "createIncident", "slot outbound is off");
    }
    assertCadWritebackEnabled(this.agencyId, "createIncident");
    const created = asRecord(
      await this.requireClient().request<unknown>("POST", this.paths().createIncident, { body: this.fromEido(request.eido) }),
    );
    const nativeIncidentId =
      firstString(created, ["incidentId", "incidentNumber", "id", "callId", "nativeIncidentId"]) ||
      request.eido.incident.IncidentId;
    return {
      nativeIncidentId,
      created: true,
      dispatched: false,
      confirmedEido: this.toEido(created),
    };
  }

  async updateIncident(nativeIncidentId: string, update: Partial<EidoEnvelope["incident"]>): Promise<void> {
    if (!this.slot.enabled || !this.slot.outboundEnabled) return;
    assertCadWritebackEnabled(this.agencyId, "updateIncident");
    await this.requireClient().request("PATCH", withId(this.paths().updateIncident, nativeIncidentId), { body: update });
  }

  async closeIncident(nativeIncidentId: string, dispositionCode?: string): Promise<void> {
    if (!this.slot.enabled || !this.slot.outboundEnabled) return;
    assertCadWritebackEnabled(this.agencyId, "closeIncident");
    await this.requireClient().request("POST", withId(this.paths().closeIncident, nativeIncidentId), {
      body: { dispositionCode },
    });
  }

  async receiveDispatchConfirmation(confirmation: EidoDispatchConfirmation): Promise<void> {
    if (!this.slot.enabled || !this.slot.outboundEnabled) return;
    assertCadWritebackEnabled(this.agencyId, "receiveDispatchConfirmation");
    await this.requireClient().request("POST", withId(this.paths().confirmDispatch, confirmation.IncidentId), {
      body: confirmation,
    });
  }

  async getUnits(query?: UnitQuery): Promise<EidoUnitStatusUpdate[]> {
    if (!this.slot.enabled || !this.client?.ready) return [];
    const data = await this.requireClient().request<unknown>("GET", this.paths().units, {
      query: { status: query?.statuses?.join(",") },
    });
    const rows = Array.isArray(data) ? data : [];
    const now = new Date().toISOString();
    return rows.map((row) => {
      const rec = asRecord(row);
      return {
        header: {
          MessageId: crypto.randomUUID(),
          DateTimeSent: now,
          SenderAgencyId: this.agencyId,
          SenderAgencyName: this.agencyName,
          RecipientAgencyId: "*",
          SchemaVersion: "APCO-NENA-2.105.1-2017" as const,
          MessageType: "UNIT_STATUS_UPDATE" as const,
        },
        UnitId: firstString(rec, ["unitId", "id"]) || "UNKNOWN",
        AgencyId: this.agencyId,
        NewStatus: firstString(rec, ["status", "currentStatus"]) || "AVAILABLE",
        Timestamp: now,
      };
    });
  }

  async getAVLPositions(): Promise<AVLPosition[]> {
    if (!this.slot.enabled || !this.client?.ready) return [];
    const data = await this.requireClient().request<unknown>("GET", this.paths().avl);
    const rows = Array.isArray(data) ? data : [];
    return rows.map((row) => {
      const rec = asRecord(row);
      return {
        unitId: firstString(rec, ["unitId", "id"]),
        agencyId: this.agencyId,
        latitude: Number(rec.latitude ?? rec.lat ?? 0),
        longitude: Number(rec.longitude ?? rec.lon ?? rec.lng ?? 0),
        heading: Number(rec.heading ?? 0),
        speedMph: Number(rec.speedMph ?? rec.speed ?? 0),
        timestamp: firstString(rec, ["timestamp", "avlDateTime"]) || new Date().toISOString(),
      };
    });
  }

  async validateAddress(address: string): Promise<AddressValidationResult> {
    return { valid: Boolean(address.trim()), normalizedAddress: address.trim() };
  }

  ingestWebhookPayload(raw: unknown): EidoEnvelope {
    return this.toEido(asRecord(raw));
  }

  private requireClient(): CadHttpClient {
    if (!this.client) throw new CADConnectionError(this.agencyId, "http", new Error("adapter not initialized"));
    return this.client;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const creds = this.creds;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "RapidCortex-C2C-Hub/1.0",
      "X-RC-Agency": this.tenantAgencyId,
      "X-RC-Slot": this.slot.slot,
    };
    if (creds?.agencyCode) headers["X-CAD-Agency"] = creds.agencyCode;
    if (creds?.apiKey) {
      headers.Authorization = `ApiKey ${creds.apiKey}`;
      return headers;
    }
    if (creds?.clientId && creds.clientSecret && creds.authTokenUrl) {
      const token = await this.oauthTokenFor(creds);
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  private async oauthTokenFor(creds: SlotCredentials): Promise<string> {
    if (this.oauthToken && Date.now() < this.oauthExpiresAt - 60_000) return this.oauthToken;
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    });
    const res = await fetch(creds.authTokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new AdapterError(`[${this.agencyId}] OAuth2 token request failed HTTP ${res.status}`, this.agencyId, "oauth");
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) throw new AdapterError(`[${this.agencyId}] OAuth2 response missing access_token`, this.agencyId, "oauth");
    this.oauthToken = json.access_token;
    this.oauthExpiresAt = Date.now() + Math.max(60, json.expires_in ?? 3600) * 1000;
    return this.oauthToken;
  }

  private toEido(raw: Record<string, unknown>): EidoEnvelope {
    const nativeId = firstString(raw, ["incidentId", "incidentNumber", "id", "callId"]) || crypto.randomUUID();
    return EidoBuilder.fromCADIncident(
      {
        nativeId,
        sourceAgencyId: this.agencyId,
        adapterType: this.slot.vendor,
        rawData: {
          ...raw,
          callType: firstString(raw, ["callType", "callTypeCode", "CallType"]) || "OT-UNKNOWN",
          city: firstString(raw, ["city", "locationCity", "City"]) || "Unknown",
          state: firstString(raw, ["state", "locationState"]) || "SC",
          address: firstString(raw, ["address", "locationAddress", "FullAddress"]) || "Unknown",
          latitude: Number(raw.latitude ?? raw.gisLatitude ?? raw.lat ?? 0) || undefined,
          longitude: Number(raw.longitude ?? raw.gisLongitude ?? raw.lon ?? raw.lng ?? 0) || undefined,
          priority: firstString(raw, ["priority", "priorityCode"]) || "3",
          receivedAt: firstString(raw, ["receivedAt", "createDateTime"]) || new Date().toISOString(),
          agencyName: this.agencyName,
        },
        fetchedAt: new Date().toISOString(),
      },
      this.agencyId,
    ).build();
  }

  private fromEido(eido: EidoEnvelope): Record<string, unknown> {
    return {
      callType: eido.incident.CallType,
      callTypeCode: eido.incident.CallType,
      callTypeDescription: eido.incident.CallTypeDescription,
      priority: eido.incident.Priority,
      priorityCode: eido.incident.Priority,
      address: eido.incident.Location.Address.FullAddress,
      locationAddress: eido.incident.Location.Address.FullAddress,
      city: eido.incident.Location.Address.City,
      locationCity: eido.incident.Location.Address.City,
      state: eido.incident.Location.Address.State,
      locationState: eido.incident.Location.Address.State,
      county: eido.incident.Location.Address.County,
      latitude: eido.incident.Location.Coordinates?.Latitude,
      longitude: eido.incident.Location.Coordinates?.Longitude,
      gisLatitude: eido.incident.Location.Coordinates?.Latitude,
      gisLongitude: eido.incident.Location.Coordinates?.Longitude,
      callerName: eido.incident.Caller?.Name,
      callerPhone: eido.incident.Caller?.CallbackNumber,
      externalSource: "RAPID_CORTEX_C2C",
      externalIncidentId: eido.incident.IncidentId,
      externalAgencyName: eido.header.SenderAgencyName,
      externalHubMessageId: eido.header.MessageId,
    };
  }
}
