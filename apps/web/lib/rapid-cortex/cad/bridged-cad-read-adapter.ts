import type { CadIncidentRecord } from "@/lib/rapid-cortex/cad/cad-models";
import type { CadReadProvider } from "@/lib/rapid-cortex/cad/cad-read-provider";
import { cadIncidentRecordToLegacy } from "@/lib/rapid-cortex/cad/map-cad-records";
import type {
  CadAdapter,
  CadApprovedUpdateInput,
  CadDraftUpdate,
  CadDraftUpdateInput,
  CadHealthResult,
  CadIncident,
  CadSearchQuery,
  CadWriteResult,
} from "@/lib/rapid-cortex/cad/CadAdapter";

/**
 * Adapts a read-only `CadReadProvider` to legacy `CadAdapter` (no write-back).
 */
export class BridgedCadReadAdapter implements CadAdapter {
  constructor(private readonly read: CadReadProvider) {}

  async healthCheck(): Promise<CadHealthResult> {
    return this.read.healthCheck();
  }

  async getIncident(incidentId: string): Promise<CadIncident> {
    const row = await this.read.getIncidentById(incidentId.trim());
    if (!row) {
      throw new Error(`CAD incident '${incidentId}' was not returned by the read adapter.`);
    }
    return cadIncidentRecordToLegacy(row);
  }

  async searchIncidents(query: CadSearchQuery): Promise<CadIncident[]> {
    const rows = await this.read.listActiveIncidents();
    const q = query.q?.trim().toLowerCase();
    const scoped = rows.filter((r) => applySearchFilters(r, query));
    const textFiltered =
      q && q.length > 0
        ? scoped.filter(
            (r) =>
              r.address.toLowerCase().includes(q) ||
              r.callType.toLowerCase().includes(q) ||
              r.incidentId.toLowerCase().includes(q),
          )
        : scoped;
    const limited =
      typeof query.limit === "number" && query.limit > 0
        ? textFiltered.slice(0, query.limit)
        : textFiltered;
    return limited.map((r) => cadIncidentRecordToLegacy(r));
  }

  async createDraftUpdate(_input: CadDraftUpdateInput): Promise<CadDraftUpdate> {
    throw new Error("CAD write-back is disabled for pilot safety.");
  }

  async submitApprovedUpdate(_input: CadApprovedUpdateInput): Promise<CadWriteResult> {
    throw new Error("CAD write-back is disabled for pilot safety.");
  }
}

function applySearchFilters(row: CadIncidentRecord, query: CadSearchQuery): boolean {
  if (query.status?.trim()) {
    const wanted = query.status.trim().toLowerCase();
    if (row.status.toLowerCase() !== wanted) return false;
  }
  const fromTs = parseIsoBoundary(query.from, "start");
  const toTs = parseIsoBoundary(query.to, "end");
  const updatedTs = Date.parse(row.updatedAt);
  if (fromTs != null && Number.isFinite(updatedTs) && updatedTs < fromTs) return false;
  if (toTs != null && Number.isFinite(updatedTs) && updatedTs > toTs) return false;
  return true;
}

function parseIsoBoundary(iso: string | undefined, mode: "start" | "end"): number | null {
  if (!iso?.trim()) return null;
  void mode;
  const t = Date.parse(iso.trim());
  if (!Number.isFinite(t)) return null;
  return t;
}
