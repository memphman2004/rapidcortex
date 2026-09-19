import { buildEido, type EidoDocument } from "@rc/eido";
import { matchTransferRules } from "./rules";
import type { C2cAgency, C2cCadAdapter, HubIncident, TransferRecord, TransferRule } from "./types";

export interface HubRunResult {
  ingested: HubIncident[];
  transfers: TransferRecord[];
  skipped: { incidentId: string; reason: string }[];
}

export class C2cHub {
  constructor(
    private readonly agencies: C2cAgency[],
    private readonly rules: TransferRule[],
    private readonly adapters: Map<string, C2cCadAdapter>,
  ) {}

  processIncident(incident: HubIncident): TransferRecord[] {
    const agency = this.agencies.find((a) => a.agencyId === incident.sourceAgencyId);
    const eido: EidoDocument = buildEido({
      incidentId: incident.incidentId,
      incidentNumber: incident.incidentNumber,
      agencyId: incident.sourceAgencyId,
      agencyName: agency?.name,
      commonIncidentTypeCode: incident.commonIncidentTypeCode,
      incidentTypeLabel: incident.incidentTypeLabel,
      priority: incident.priority,
      status: incident.status,
      notes: incident.notes,
      latitude: incident.latitude,
      longitude: incident.longitude,
      civicAddress: incident.civicAddress,
      city: incident.city,
      state: incident.state,
      occurredAt: incident.occurredAt,
    });
    const matches = matchTransferRules(incident, this.rules);
    const out: TransferRecord[] = [];
    for (const rule of matches) {
      const dest = this.adapters.get(rule.destAgencyId);
      if (!dest) continue;
      const record: TransferRecord = {
        transferId: `${incident.incidentId}->${rule.destAgencyId}`,
        ruleId: rule.ruleId,
        fromAgencyId: incident.sourceAgencyId,
        toAgencyId: rule.destAgencyId,
        incidentId: incident.incidentId,
        eido,
        deliveredAt: new Date().toISOString(),
      };
      dest.deliver(eido, { transferId: record.transferId, ruleId: rule.ruleId });
      out.push(record);
    }
    return out;
  }

  runProducer(sourceAgencyId: string): HubRunResult {
    const adapter = this.adapters.get(sourceAgencyId);
    const ingested = adapter?.ingest() ?? [];
    const transfers: TransferRecord[] = [];
    const skipped: HubRunResult["skipped"] = [];
    for (const incident of ingested) {
      const matches = matchTransferRules(incident, this.rules);
      if (matches.length === 0) {
        skipped.push({ incidentId: incident.incidentId, reason: "no matching transfer rule" });
        continue;
      }
      const made = this.processIncident(incident);
      if (made.length === 0) {
        skipped.push({ incidentId: incident.incidentId, reason: "destination adapter not registered" });
        continue;
      }
      transfers.push(...made);
    }
    return { ingested, transfers, skipped };
  }
}
