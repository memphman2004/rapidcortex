import type { CadIncidentRecord } from "@/lib/rapid-cortex/cad/cad-models";
import type { CadIncident } from "@/lib/rapid-cortex/cad/CadAdapter";

export function cadIncidentRecordToLegacy(incident: CadIncidentRecord): CadIncident {
  return {
    incidentId: incident.incidentId,
    externalId: incident.externalCadId,
    status: incident.status,
    callType: incident.callType,
    location: incident.address,
    units: [...incident.assignedUnits],
    lastUpdatedAt: incident.updatedAt,
    raw: { ...incident } as Record<string, unknown>,
  };
}
