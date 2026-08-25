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
import {
  asUnitList,
  cadHttpGetJson,
  firstString,
  unwrapCadIncidentList,
} from "@/lib/rapid-cortex/cad/vendors/http-json-cad-client";

type FetchLike = typeof fetch;

export class CentralSquareCadAdapter implements CadAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: FetchLike;

  constructor(options?: {
    baseUrl?: string;
    apiKey?: string;
    timeoutMs?: number;
    fetchFn?: FetchLike;
  }) {
    this.baseUrl = (options?.baseUrl ?? process.env.CAD_API_BASE_URL ?? "").replace(/\/$/, "");
    this.apiKey = (options?.apiKey ?? process.env.CAD_API_KEY ?? "").trim();
    this.timeoutMs = options?.timeoutMs ?? Number(process.env.CAD_TIMEOUT_MS ?? 5000);
    this.fetchFn = options?.fetchFn ?? fetch;
  }

  async healthCheck(): Promise<CadHealthResult> {
    try {
      this.ensureConfigured();
      await this.request("/health");
      return {
        ok: true,
        mode: "read_only",
        provider: "centralsquare",
        detail: "CentralSquare CAD read-only adapter healthy.",
      };
    } catch (error) {
      return {
        ok: false,
        mode: "read_only",
        provider: "centralsquare",
        detail: error instanceof Error ? error.message : "CentralSquare health check failed.",
      };
    }
  }

  async getIncident(incidentId: string): Promise<CadIncident> {
    this.ensureConfigured();
    if (!incidentId.trim()) throw new Error("incidentId is required.");
    const payload = await this.request(`/incidents/${encodeURIComponent(incidentId)}`);
    return this.mapIncident(payload, incidentId);
  }

  async searchIncidents(query: CadSearchQuery): Promise<CadIncident[]> {
    this.ensureConfigured();
    const search = new URLSearchParams();
    if (query.q) search.set("q", query.q);
    if (query.status) search.set("status", query.status);
    if (query.from) search.set("from", query.from);
    if (query.to) search.set("to", query.to);
    if (query.limit) search.set("limit", String(query.limit));
    const suffix = search.toString();
    const payload = await this.request(`/incidents${suffix ? `?${suffix}` : ""}`);
    const list = Array.isArray(payload) ? payload : unwrapCadIncidentList(payload);
    return list.map((item, index) => this.mapIncident(item, `centralsquare-incident-${index}`));
  }

  async createDraftUpdate(_input: CadDraftUpdateInput): Promise<CadDraftUpdate> {
    throw new Error("CAD write operations are disabled for read-only pilot.");
  }

  async submitApprovedUpdate(_input: CadApprovedUpdateInput): Promise<CadWriteResult> {
    throw new Error("CAD write operations are disabled for read-only pilot.");
  }

  private ensureConfigured(): void {
    if (!this.baseUrl) throw new Error("CAD_API_BASE_URL is required for CentralSquare CAD adapter.");
    if (!this.apiKey) throw new Error("CAD_API_KEY is required for CentralSquare CAD adapter.");
  }

  private request(path: string): Promise<unknown> {
    return cadHttpGetJson({
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
      path,
      timeoutMs: this.timeoutMs,
      fetchFn: this.fetchFn,
    });
  }

  private mapIncident(raw: unknown, fallbackId: string): CadIncident {
    if (!raw || typeof raw !== "object") {
      throw new Error("Malformed CAD response: incident object missing.");
    }
    const rec = raw as Record<string, unknown>;
    return {
      incidentId: String(
        firstString(rec, ["IncidentId", "IncidentNumber", "incident_id", "incidentId", "id"]) ?? fallbackId,
      ),
      status: firstString(rec, ["Status", "incident_status", "status"]),
      callType: firstString(rec, ["NatureOfCall", "nature", "incident_type", "callType"]),
      location: firstString(rec, ["Address", "address", "location"]),
      units: asUnitList(rec.UnitList ?? rec.assigned_units ?? rec.units),
      lastUpdatedAt: firstString(rec, ["updatedAt", "UpdatedAt", "ModifiedOn"]),
      raw: rec,
    };
  }
}
