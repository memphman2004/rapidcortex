import { lookupIncidentType } from "@rc/common-codes";
import type { C2cCadAdapter, HubIncident, TransferRecord } from "../types";
import type { EidoDocument } from "@rc/eido";

/**
 * Southern Software CAD partner stub. Maps typical CAD XML/JSON fields
 * (see docs/c2c-hub/SOUTHERN_SOFTWARE_API_SPEC.md). Not a live vendor client.
 */
export class SouthernSoftwareAdapter implements C2cCadAdapter {
  readonly vendorId = "southern_software" as const;
  readonly received: TransferRecord[] = [];

  constructor(readonly agencyId: string) {}

  ingest(): HubIncident[] {
    return [];
  }

  mapVendorIncident(raw: Record<string, unknown>): HubIncident {
    const callType = String(raw.CallType ?? raw.callType ?? "");
    const row = lookupIncidentType(callType);
    const id = String(raw.CallNumber ?? raw.callNumber ?? "");
    return {
      incidentId: id,
      incidentNumber: id,
      sourceAgencyId: this.agencyId,
      cadCallType: callType,
      commonIncidentTypeCode: row?.code ?? "MEDIC",
      incidentTypeLabel: row?.label ?? callType,
      priority: Number(raw.Priority ?? row?.defaultPriority ?? 3),
      status: String(raw.Status ?? "active"),
      civicAddress: raw.Address ? String(raw.Address) : undefined,
      city: raw.City ? String(raw.City) : undefined,
      state: raw.State ? String(raw.State) : "SC",
      latitude: raw.Latitude !== undefined ? Number(raw.Latitude) : undefined,
      longitude: raw.Longitude !== undefined ? Number(raw.Longitude) : undefined,
      notes: raw.Comments ? String(raw.Comments) : undefined,
      occurredAt: String(raw.CreateTime ?? new Date().toISOString()),
    };
  }

  deliver(eido: EidoDocument, meta: { transferId: string; ruleId: string }): void {
    this.received.push({
      transferId: meta.transferId,
      ruleId: meta.ruleId,
      fromAgencyId: eido.issuingElementIdentification,
      toAgencyId: this.agencyId,
      incidentId: eido.incidentComponent?.[0]?.incidentNumber ?? eido.$id,
      eido,
      deliveredAt: new Date().toISOString(),
    });
  }

  receivedTransfers(): TransferRecord[] {
    return [...this.received];
  }
}

/**
 * CentralSquare CAD Pro / OnDemand partner stub.
 * Field names follow docs/c2c-hub/CENTRALSQUARE_API_SPEC.md.
 */
export class CentralSquareC2cAdapter implements C2cCadAdapter {
  readonly vendorId = "centralsquare" as const;
  readonly received: TransferRecord[] = [];

  constructor(readonly agencyId: string) {}

  ingest(): HubIncident[] {
    return [];
  }

  mapVendorIncident(raw: Record<string, unknown>): HubIncident {
    const callType = String(raw.call_type ?? raw.callType ?? "");
    const row = lookupIncidentType(callType);
    const id = String(raw.call_number ?? raw.callNumber ?? "");
    const loc = (raw.location as Record<string, unknown> | undefined) ?? {};
    return {
      incidentId: id,
      incidentNumber: id,
      sourceAgencyId: this.agencyId,
      cadCallType: callType,
      commonIncidentTypeCode: row?.code ?? "MEDIC",
      incidentTypeLabel: row?.label ?? callType,
      priority: Number(raw.priority ?? row?.defaultPriority ?? 3),
      status: String(raw.call_status ?? "active"),
      civicAddress: loc.address ? String(loc.address) : undefined,
      latitude: loc.lat !== undefined ? Number(loc.lat) : undefined,
      longitude: loc.lng !== undefined ? Number(loc.lng) : undefined,
      occurredAt: String(raw.received_at ?? new Date().toISOString()),
    };
  }

  deliver(eido: EidoDocument, meta: { transferId: string; ruleId: string }): void {
    this.received.push({
      transferId: meta.transferId,
      ruleId: meta.ruleId,
      fromAgencyId: eido.issuingElementIdentification,
      toAgencyId: this.agencyId,
      incidentId: eido.incidentComponent?.[0]?.incidentNumber ?? eido.$id,
      eido,
      deliveredAt: new Date().toISOString(),
    });
  }

  receivedTransfers(): TransferRecord[] {
    return [...this.received];
  }
}
