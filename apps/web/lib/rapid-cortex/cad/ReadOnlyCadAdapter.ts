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

export class ReadOnlyCadAdapter implements CadAdapter {
  async healthCheck(): Promise<CadHealthResult> {
    return {
      ok: true,
      mode: "read_only",
      provider: process.env.CAD_VENDOR_NAME?.trim() || "configured-vendor",
      detail:
        "Read-only CAD adapter active. Write-back remains blocked until assisted mode approval.",
    };
  }

  async getIncident(incidentId: string): Promise<CadIncident> {
    return {
      incidentId,
      status: "read_only",
      raw: {
        note: "Sandbox placeholder. Implement vendor adapter to fetch live CAD incidents.",
      },
    };
  }

  async searchIncidents(query: CadSearchQuery): Promise<CadIncident[]> {
    return [
      {
        incidentId: "sandbox-incident-1",
        status: "open",
        callType: query.q ? `query:${query.q}` : "sandbox",
        raw: { note: "Read-only sandbox response" },
      },
    ];
  }

  async createDraftUpdate(_input: CadDraftUpdateInput): Promise<CadDraftUpdate> {
    throw new Error("Read-only CAD mode blocks draft update creation.");
  }

  async submitApprovedUpdate(_input: CadApprovedUpdateInput): Promise<CadWriteResult> {
    throw new Error("Read-only CAD mode blocks write-back.");
  }
}
