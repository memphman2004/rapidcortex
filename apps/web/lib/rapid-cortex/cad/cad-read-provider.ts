import type { CadEventRecord, CadIncidentRecord, CadUnitRecord } from "@/lib/rapid-cortex/cad/cad-models";
import type { CadHealthResult } from "@/lib/rapid-cortex/cad/CadAdapter";

/**
 * Read-only CAD provider contract. Extend with vendor adapters (staging, Motorola, Tyler, Hexagon …).
 */
export interface CadReadProvider {
  healthCheck(): Promise<CadHealthResult>;

  /** Active / open incidents visible to Rapid Cortex (vendor-specific definition of active). */
  listActiveIncidents(): Promise<CadIncidentRecord[]>;

  getIncidentById(incidentId: string): Promise<CadIncidentRecord | null>;

  listUnits(): Promise<CadUnitRecord[]>;

  getUnitStatus(unitId: string): Promise<CadUnitRecord | null>;

  getRecentCadEvents(): Promise<CadEventRecord[]>;
}
