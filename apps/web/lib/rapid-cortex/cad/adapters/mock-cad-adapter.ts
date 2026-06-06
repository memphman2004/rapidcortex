import type { CadAdapter, CadIncidentSearchQuery } from "@/lib/rapid-cortex/cad/cad-adapter";
import type {
  CadAdapterResult,
  CadConnectionConfig,
  CadDispositionUpdate,
  CadIncident,
  CadIncidentDraft,
  CadMediaLink,
  CadNarrativeNote,
} from "@/lib/rapid-cortex/cad/types";

function nowIso(): string {
  return new Date().toISOString();
}

export class MockCadAdapter implements CadAdapter {
  private readonly failureRate: number;
  private readonly incidents = new Map<string, CadIncident>();

  constructor(failureRate = 0) {
    this.failureRate = Math.max(0, Math.min(1, failureRate));
    const seedIncident: CadIncident = {
      agencyId: "demo-agency",
      incidentId: "INC-1001",
      externalCadId: "MOCK-CAD-1001",
      callType: "Medical",
      priority: "P2",
      callerName: "Test Caller",
      callerPhone: "555-0100",
      location: "100 Main St",
      latitude: 40.0,
      longitude: -74.0,
      narrative: "Caller reports chest pain.",
      summary: "Medical assistance requested.",
      mediaUrls: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      status: "open",
    };
    this.incidents.set(seedIncident.incidentId, seedIncident);
  }

  private maybeFail<T>(operation: string): CadAdapterResult<T> | null {
    if (this.failureRate <= 0) return null;
    if (Math.random() >= this.failureRate) return null;
    return {
      ok: false,
      vendor: "mock",
      error: {
        code: "MOCK_FAILURE",
        message: `Mock CAD simulated failure during ${operation}.`,
      },
    };
  }

  async healthCheck(): Promise<CadAdapterResult<{ status: "ok" | "degraded" | "offline"; detail: string }>> {
    const failure = this.maybeFail<{ status: "ok" | "degraded" | "offline"; detail: string }>("healthCheck");
    if (failure) return failure;
    return {
      ok: true,
      vendor: "mock",
      data: { status: "ok", detail: "Mock CAD is available in demo mode." },
    };
  }

  async getIncident(incidentId: string): Promise<CadAdapterResult<CadIncident>> {
    const failure = this.maybeFail<CadIncident>("getIncident");
    if (failure) return failure;
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      return {
        ok: false,
        vendor: "mock",
        error: { code: "NOT_FOUND", message: `Incident ${incidentId} was not found.` },
      };
    }
    return { ok: true, vendor: "mock", data: incident };
  }

  async searchIncidents(query: CadIncidentSearchQuery): Promise<CadAdapterResult<CadIncident[]>> {
    const failure = this.maybeFail<CadIncident[]>("searchIncidents");
    if (failure) return failure;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const q = query.q?.trim().toLowerCase();
    const incidents = [...this.incidents.values()].filter((incident) => {
      if (incident.agencyId !== query.agencyId) return false;
      if (!q) return true;
      return (
        incident.incidentId.toLowerCase().includes(q) ||
        (incident.externalCadId?.toLowerCase().includes(q) ?? false) ||
        (incident.callType?.toLowerCase().includes(q) ?? false) ||
        (incident.location?.toLowerCase().includes(q) ?? false)
      );
    });
    return { ok: true, vendor: "mock", data: incidents.slice(0, limit) };
  }

  async createIncidentDraft(payload: {
    agencyId: string;
    incidentId: string;
    summary: string;
    narrative?: string;
  }): Promise<CadAdapterResult<CadIncidentDraft>> {
    const failure = this.maybeFail<CadIncidentDraft>("createIncidentDraft");
    if (failure) return failure;
    const draft: CadIncidentDraft = {
      agencyId: payload.agencyId,
      incidentId: payload.incidentId,
      draftId: `DRAFT-${Date.now()}`,
      summary: payload.summary,
      narrative: payload.narrative,
      status: "draft",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    return { ok: true, vendor: "mock", data: draft };
  }

  async addNarrativeNote(
    incidentId: string,
    notePayload: CadNarrativeNote,
  ): Promise<CadAdapterResult<CadIncident>> {
    const failure = this.maybeFail<CadIncident>("addNarrativeNote");
    if (failure) return failure;
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      return {
        ok: false,
        vendor: "mock",
        error: { code: "NOT_FOUND", message: `Incident ${incidentId} was not found.` },
      };
    }
    const next: CadIncident = {
      ...incident,
      narrative: `${incident.narrative ?? ""}\n${notePayload.note}`.trim(),
      updatedAt: nowIso(),
    };
    this.incidents.set(incidentId, next);
    return { ok: true, vendor: "mock", data: next };
  }

  async attachMediaLink(
    incidentId: string,
    mediaPayload: CadMediaLink,
  ): Promise<CadAdapterResult<CadIncident>> {
    const failure = this.maybeFail<CadIncident>("attachMediaLink");
    if (failure) return failure;
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      return {
        ok: false,
        vendor: "mock",
        error: { code: "NOT_FOUND", message: `Incident ${incidentId} was not found.` },
      };
    }
    const mediaUrls = [...(incident.mediaUrls ?? []), mediaPayload.mediaUrl];
    const next: CadIncident = { ...incident, mediaUrls, updatedAt: nowIso() };
    this.incidents.set(incidentId, next);
    return { ok: true, vendor: "mock", data: next };
  }

  async updateDisposition(
    incidentId: string,
    dispositionPayload: CadDispositionUpdate,
  ): Promise<CadAdapterResult<CadIncident>> {
    const failure = this.maybeFail<CadIncident>("updateDisposition");
    if (failure) return failure;
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      return {
        ok: false,
        vendor: "mock",
        error: { code: "NOT_FOUND", message: `Incident ${incidentId} was not found.` },
      };
    }
    const next: CadIncident = {
      ...incident,
      status: dispositionPayload.disposition,
      summary: `${incident.summary ?? ""}\nDisposition: ${dispositionPayload.disposition}`.trim(),
      updatedAt: nowIso(),
    };
    this.incidents.set(incidentId, next);
    return { ok: true, vendor: "mock", data: next };
  }

  async validateConnection(_config: CadConnectionConfig): Promise<CadAdapterResult<{ valid: boolean }>> {
    const failure = this.maybeFail<{ valid: boolean }>("validateConnection");
    if (failure) return failure;
    return { ok: true, vendor: "mock", data: { valid: true } };
  }
}
