/**
 * Fully live mock CAD adapter for demos and integration tests.
 * Generates realistic EIDO traffic; never calls a partner CAD.
 */

import { APCO_INCIDENT_TYPES, type APCOIncidentTypeCode } from "../common-codes/incident-types.js";
import type {
  EidoDispatchConfirmation,
  EidoEnvelope,
  EidoTransferRequest,
  EidoTransferResponse,
  EidoUnitStatusUpdate,
  IncidentPriority,
  IncidentStatus,
} from "../eido/types.js";
import type {
  AdapterEventHandler,
  AdapterHealthStatus,
  AddressValidationResult,
  AVLPosition,
  CreateIncidentRequest,
  CreateIncidentResult,
  ICadAdapter,
  IncidentQuery,
  IncidentQueryResult,
  UnsubscribeFn,
  UnitQuery,
} from "./adapter.interface.js";

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface MockAdapterConfig {
  agencyId: string;
  agencyName: string;
  boundingBox: BoundingBox;
  incidentRatePerHour: number;
  unitCount: number;
  incidentTypeDist: Partial<Record<APCOIncidentTypeCode, number>>;
}

function pickWeighted(dist: Partial<Record<string, number>>): string {
  const entries = Object.entries(dist).filter(([, w]) => (w ?? 0) > 0);
  if (!entries.length) return "TC-MVC";
  const total = entries.reduce((sum, [, w]) => sum + (w ?? 0), 0);
  let roll = Math.random() * total;
  for (const [code, weight] of entries) {
    roll -= weight ?? 0;
    if (roll <= 0) return code;
  }
  return entries[0]![0];
}

function randomInBox(box: BoundingBox): { lat: number; lon: number } {
  return {
    lat: box.minLat + Math.random() * (box.maxLat - box.minLat),
    lon: box.minLon + Math.random() * (box.maxLon - box.minLon),
  };
}

export class MockCadAdapter implements ICadAdapter {
  readonly agencyId: string;
  readonly agencyName: string;
  readonly cadSystem = "MOCK";

  private incidents = new Map<string, EidoEnvelope>();
  private units: Array<{ unitId: string; status: string; lat: number; lon: number; incidentId?: string }> = [];
  private handlers: AdapterEventHandler[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;
  private lastContact = new Date().toISOString();

  constructor(private readonly config: MockAdapterConfig) {
    this.agencyId = config.agencyId;
    this.agencyName = config.agencyName;
  }

  async initialize(): Promise<void> {
    const box = this.config.boundingBox;
    this.units = Array.from({ length: Math.max(1, this.config.unitCount) }, (_, i) => {
      const pos = randomInBox(box);
      return {
        unitId: `${this.agencyId.replace(/[^A-Z0-9]/gi, "").slice(0, 8)}-U${i + 1}`.toUpperCase().slice(0, 20),
        status: "AVAILABLE",
        lat: pos.lat,
        lon: pos.lon,
      };
    });
    this.initialized = true;
    if (this.config.incidentRatePerHour <= 0) return;
    const intervalMs = Math.max(5_000, Math.round(3_600_000 / Math.max(1, this.config.incidentRatePerHour)));
    this.timer = setInterval(() => {
      void this.generateCycle();
    }, intervalMs);
    await this.generateCycle();
  }

  async shutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.initialized = false;
  }

  async healthCheck(): Promise<AdapterHealthStatus> {
    return {
      agencyId: this.agencyId,
      adapterType: "MOCK",
      cadSystem: this.cadSystem,
      cadVersion: "mock-1",
      status: this.initialized ? "ONLINE" : "OFFLINE",
      lastSuccessfulContact: this.lastContact,
      activeIncidentCount: [...this.incidents.values()].filter((e) =>
        ["PENDING", "DISPATCHED", "ACTIVE", "ON_SCENE"].includes(e.incident.Status),
      ).length,
      availableUnitCount: this.units.filter((u) => u.status === "AVAILABLE").length,
    };
  }

  async getActiveIncidents(query?: IncidentQuery): Promise<IncidentQueryResult> {
    let incidents = [...this.incidents.values()];
    if (query?.since) {
      const since = Date.parse(query.since);
      incidents = incidents.filter((e) => Date.parse(e.incident.UpdatedAt) >= since);
    }
    if (query?.statuses?.length) {
      incidents = incidents.filter((e) => query.statuses!.includes(e.incident.Status));
    }
    const limit = query?.limit ?? incidents.length;
    return { incidents: incidents.slice(0, limit), hasMore: incidents.length > limit, totalCount: incidents.length };
  }

  async getIncidentById(nativeIncidentId: string): Promise<EidoEnvelope | null> {
    return this.incidents.get(nativeIncidentId) ?? null;
  }

  async createIncident(request: CreateIncidentRequest): Promise<CreateIncidentResult> {
    const nativeIncidentId = `${this.agencyId}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();
    const eido: EidoEnvelope = structuredClone(request.eido);
    eido.incident.IncidentId = nativeIncidentId;
    eido.incident.Status = request.autoDispatch ? "DISPATCHED" : "PENDING";
    eido.incident.UpdatedAt = now;
    if (request.autoDispatch) {
      const unit = this.units.find((u) => u.status === "AVAILABLE");
      if (unit) {
        unit.status = "DISPATCHED";
        unit.incidentId = nativeIncidentId;
        eido.incident.Units = [
          {
            UnitId: unit.unitId,
            UnitType: "PATROL",
            AgencyId: this.agencyId,
            Status: "DISPATCHED",
            DispatchedAt: now,
            CurrentLocation: { Latitude: unit.lat, Longitude: unit.lon },
          },
        ];
        eido.incident.DispatchedAt = now;
      }
    }
    this.incidents.set(nativeIncidentId, eido);
    this.lastContact = now;
    await this.emit({ type: "INCIDENT_CREATED", agencyId: this.agencyId, timestamp: now, eido });
    return {
      nativeIncidentId,
      created: true,
      dispatched: request.autoDispatch,
      assignedUnits: eido.incident.Units?.map((u) => ({
        header: {
          MessageId: crypto.randomUUID(),
          DateTimeSent: now,
          SenderAgencyId: this.agencyId,
          SenderAgencyName: this.agencyName,
          RecipientAgencyId: "*",
          SchemaVersion: "APCO-NENA-2.105.1-2017",
          MessageType: "UNIT_STATUS_UPDATE",
        },
        UnitId: u.UnitId,
        AgencyId: this.agencyId,
        NewStatus: u.Status,
        Timestamp: now,
        IncidentId: nativeIncidentId,
      })),
      confirmedEido: eido,
    };
  }

  async updateIncident(nativeIncidentId: string, update: Partial<EidoEnvelope["incident"]>): Promise<void> {
    const existing = this.incidents.get(nativeIncidentId);
    if (!existing) return;
    existing.incident = { ...existing.incident, ...update, UpdatedAt: new Date().toISOString() };
    await this.emit({
      type: "INCIDENT_UPDATED",
      agencyId: this.agencyId,
      timestamp: existing.incident.UpdatedAt,
      eido: existing,
    });
  }

  async closeIncident(nativeIncidentId: string, dispositionCode?: string): Promise<void> {
    const existing = this.incidents.get(nativeIncidentId);
    if (!existing) return;
    const now = new Date().toISOString();
    existing.incident.Status = "CLEARED";
    existing.incident.ClearedAt = now;
    existing.incident.UpdatedAt = now;
    if (dispositionCode) existing.incident.Disposition = dispositionCode;
    for (const unit of this.units) {
      if (unit.incidentId === nativeIncidentId) {
        unit.status = "AVAILABLE";
        unit.incidentId = undefined;
      }
    }
    await this.emit({ type: "INCIDENT_CLOSED", agencyId: this.agencyId, timestamp: now, eido: existing });
  }

  async receiveTransferRequest(request: EidoTransferRequest): Promise<EidoTransferResponse> {
    const created = await this.createIncident({
      eido: { header: request.header, incident: request.incident },
      autoDispatch: request.transfer.AutoDispatch,
      transferRequestMessageId: request.header.MessageId,
    });
    return {
      header: {
        ...request.header,
        MessageId: crypto.randomUUID(),
        DateTimeSent: new Date().toISOString(),
        MessageType: "TRANSFER_ACCEPT",
        SenderAgencyId: this.agencyId,
        SenderAgencyName: this.agencyName,
      },
      TransferRequestMessageId: request.header.MessageId,
      Response: "ACCEPT",
      AssignedUnits: created.confirmedEido?.incident.Units,
    };
  }

  async receiveDispatchConfirmation(confirmation: EidoDispatchConfirmation): Promise<void> {
    const existing = [...this.incidents.values()].find((e) => e.incident.IncidentId === confirmation.IncidentId);
    if (!existing) return;
    existing.incident.Units = [...(existing.incident.Units ?? []), ...confirmation.AssignedUnits];
    existing.incident.UpdatedAt = confirmation.ConfirmedAt;
  }

  async getUnits(query?: UnitQuery): Promise<EidoUnitStatusUpdate[]> {
    const now = new Date().toISOString();
    return this.units
      .filter((u) => !query?.statuses?.length || query.statuses.includes(u.status))
      .map((u) => ({
        header: {
          MessageId: crypto.randomUUID(),
          DateTimeSent: now,
          SenderAgencyId: this.agencyId,
          SenderAgencyName: this.agencyName,
          RecipientAgencyId: "*",
          SchemaVersion: "APCO-NENA-2.105.1-2017" as const,
          MessageType: "UNIT_STATUS_UPDATE" as const,
        },
        UnitId: u.unitId,
        AgencyId: this.agencyId,
        NewStatus: u.status,
        Timestamp: now,
        IncidentId: u.incidentId,
        Location: { Latitude: u.lat, Longitude: u.lon },
      }));
  }

  async getAVLPositions(): Promise<AVLPosition[]> {
    const now = new Date().toISOString();
    return this.units.map((u) => ({
      unitId: u.unitId,
      agencyId: this.agencyId,
      latitude: u.lat,
      longitude: u.lon,
      heading: Math.floor(Math.random() * 360),
      speedMph: u.status === "EN_ROUTE" ? 25 + Math.floor(Math.random() * 20) : 0,
      timestamp: now,
      status: u.status,
    }));
  }

  async subscribeToEvents(handler: AdapterEventHandler): Promise<UnsubscribeFn> {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  async validateAddress(address: string): Promise<AddressValidationResult> {
    return { valid: Boolean(address.trim()), normalizedAddress: address.trim() };
  }

  private async generateCycle(): Promise<void> {
    const now = new Date().toISOString();
    this.lastContact = now;
    const callType = pickWeighted(this.config.incidentTypeDist);
    const typeMeta = APCO_INCIDENT_TYPES[callType as keyof typeof APCO_INCIDENT_TYPES];
    const pos = randomInBox(this.config.boundingBox);
    const nativeId = `${this.agencyId}-${Date.now().toString(36).toUpperCase()}`;
    const eido: EidoEnvelope = {
      header: {
        MessageId: crypto.randomUUID(),
        DateTimeSent: now,
        SenderAgencyId: this.agencyId,
        SenderAgencyName: this.agencyName,
        RecipientAgencyId: "*",
        SchemaVersion: "APCO-NENA-2.105.1-2017",
        MessageType: "NEW_INCIDENT",
      },
      incident: {
        IncidentId: nativeId,
        CallType: callType,
        CallTypeDescription: typeMeta?.description ?? callType,
        Priority: (["1", "2", "3"][Math.floor(Math.random() * 3)] ?? "3") as IncidentPriority,
        Status: "PENDING" as IncidentStatus,
        Location: {
          Address: {
            FullAddress: "Simulated incident location",
            StreetName: "Main St",
            City: this.agencyName,
            State: "SC",
          },
          Coordinates: { Latitude: pos.lat, Longitude: pos.lon, DeterminationMethod: "GPS" },
        },
        ReceivedAt: now,
        UpdatedAt: now,
      },
    };
    this.incidents.set(nativeId, eido);
    await this.emit({ type: "INCIDENT_CREATED", agencyId: this.agencyId, timestamp: now, eido });

    const unit = this.units.find((u) => u.status === "AVAILABLE");
    if (unit) {
      unit.status = "DISPATCHED";
      unit.incidentId = nativeId;
      eido.incident.Status = "DISPATCHED";
      eido.incident.DispatchedAt = now;
      eido.incident.Units = [
        {
          UnitId: unit.unitId,
          UnitType: "PATROL",
          AgencyId: this.agencyId,
          Status: "DISPATCHED",
          DispatchedAt: now,
        },
      ];
      await this.emit({ type: "INCIDENT_UPDATED", agencyId: this.agencyId, timestamp: now, eido });
    }
  }

  private async emit(event: Parameters<AdapterEventHandler>[0]): Promise<void> {
    for (const handler of this.handlers) {
      await handler(event);
    }
  }
}
