/**
 * Stub adapter when CAD is disabled/not configured — **never performs vendor I/O**.
 * TODO(prod) — Section 4.3: route every call through auditing (`cad.action_attempted`, result=`blocked`).
 */
import type { CadAdapter, CadIncidentSearchQuery } from "@/lib/rapid-cortex/cad/cad-adapter";
import type {
  CadAdapterResult,
  CadConnectionConfig,
  CadDispositionUpdate,
  CadIncident,
  CadIncidentDraft,
  CadMediaLink,
  CadNarrativeNote,
  CadVendor,
} from "@/lib/rapid-cortex/cad/types";

function notConfigured<T>(vendor: CadVendor, operation: string): CadAdapterResult<T> {
  return {
    ok: false,
    vendor,
    error: {
      code: "NOT_CONFIGURED",
      message: `${vendor} adapter is not configured for ${operation}.`,
    },
  };
}

export class NotConfiguredCadAdapter implements CadAdapter {
  constructor(private readonly vendor: CadVendor) {}

  async healthCheck(): Promise<CadAdapterResult<{ status: "ok" | "degraded" | "offline"; detail: string }>> {
    return notConfigured(this.vendor, "healthCheck");
  }

  async getIncident(_incidentId: string): Promise<CadAdapterResult<CadIncident>> {
    return notConfigured(this.vendor, "getIncident");
  }

  async searchIncidents(_query: CadIncidentSearchQuery): Promise<CadAdapterResult<CadIncident[]>> {
    return notConfigured(this.vendor, "searchIncidents");
  }

  async createIncidentDraft(_payload: {
    agencyId: string;
    incidentId: string;
    summary: string;
    narrative?: string;
  }): Promise<CadAdapterResult<CadIncidentDraft>> {
    return notConfigured(this.vendor, "createIncidentDraft");
  }

  async addNarrativeNote(
    _incidentId: string,
    _notePayload: CadNarrativeNote,
  ): Promise<CadAdapterResult<CadIncident>> {
    return notConfigured(this.vendor, "addNarrativeNote");
  }

  async attachMediaLink(
    _incidentId: string,
    _mediaPayload: CadMediaLink,
  ): Promise<CadAdapterResult<CadIncident>> {
    return notConfigured(this.vendor, "attachMediaLink");
  }

  async updateDisposition(
    _incidentId: string,
    _dispositionPayload: CadDispositionUpdate,
  ): Promise<CadAdapterResult<CadIncident>> {
    return notConfigured(this.vendor, "updateDisposition");
  }

  async validateConnection(
    _config: CadConnectionConfig,
  ): Promise<CadAdapterResult<{ valid: boolean }>> {
    return notConfigured(this.vendor, "validateConnection");
  }
}
