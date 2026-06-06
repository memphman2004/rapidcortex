import type {
  CadAdapterResult,
  CadConnectionConfig,
  CadDispositionUpdate,
  CadIncident,
  CadIncidentDraft,
  CadMediaLink,
  CadNarrativeNote,
} from "@/lib/rapid-cortex/cad/types";

export type CadIncidentSearchQuery = {
  agencyId: string;
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
};

export interface CadAdapter {
  healthCheck(): Promise<CadAdapterResult<{ status: "ok" | "degraded" | "offline"; detail: string }>>;
  getIncident(incidentId: string): Promise<CadAdapterResult<CadIncident>>;
  searchIncidents(query: CadIncidentSearchQuery): Promise<CadAdapterResult<CadIncident[]>>;
  createIncidentDraft(payload: {
    agencyId: string;
    incidentId: string;
    summary: string;
    narrative?: string;
  }): Promise<CadAdapterResult<CadIncidentDraft>>;
  addNarrativeNote(
    incidentId: string,
    notePayload: CadNarrativeNote,
  ): Promise<CadAdapterResult<CadIncident>>;
  attachMediaLink(
    incidentId: string,
    mediaPayload: CadMediaLink,
  ): Promise<CadAdapterResult<CadIncident>>;
  updateDisposition(
    incidentId: string,
    dispositionPayload: CadDispositionUpdate,
  ): Promise<CadAdapterResult<CadIncident>>;
  validateConnection(config: CadConnectionConfig): Promise<CadAdapterResult<{ valid: boolean }>>;
}
