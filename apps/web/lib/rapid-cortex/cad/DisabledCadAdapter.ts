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

function disabledError(action: string): Error {
  return new Error(
    `CAD integration is disabled. Cannot execute '${action}'. Configure discovery/read-only mode first.`,
  );
}

export class DisabledCadAdapter implements CadAdapter {
  async healthCheck(): Promise<CadHealthResult> {
    return {
      ok: true,
      mode: "disabled",
      provider: "none",
      detail: "CAD integration disabled by configuration.",
    };
  }

  async getIncident(_incidentId: string): Promise<CadIncident> {
    throw disabledError("getIncident");
  }

  async searchIncidents(_query: CadSearchQuery): Promise<CadIncident[]> {
    throw disabledError("searchIncidents");
  }

  async createDraftUpdate(_input: CadDraftUpdateInput): Promise<CadDraftUpdate> {
    throw disabledError("createDraftUpdate");
  }

  async submitApprovedUpdate(_input: CadApprovedUpdateInput): Promise<CadWriteResult> {
    throw disabledError("submitApprovedUpdate");
  }
}
