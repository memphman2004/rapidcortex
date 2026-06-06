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

type FetchLike = typeof fetch;

type MotorolaIncident = {
  id?: string;
  incidentId?: string;
  status?: string;
  callType?: string;
  location?: string;
  units?: string[];
  updatedAt?: string;
  [key: string]: unknown;
};

type MotorolaUnit = {
  unitId?: string;
  status?: string;
  assignedIncidentId?: string;
  [key: string]: unknown;
};

export class MotorolaPremierOneCadAdapter implements CadAdapter {
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
      await this.ensureConfigured();
      await this.request("/health");
      return {
        ok: true,
        mode: "read_only",
        provider: "motorola-premierone",
        detail: "Motorola PremierOne CAD read-only adapter healthy.",
      };
    } catch (error) {
      return {
        ok: false,
        mode: "read_only",
        provider: "motorola-premierone",
        detail: error instanceof Error ? error.message : "Motorola health check failed.",
      };
    }
  }

  async getIncident(incidentId: string): Promise<CadIncident> {
    await this.ensureConfigured();
    if (!incidentId.trim()) {
      throw new Error("incidentId is required.");
    }
    const payload = await this.request(`/incidents/${encodeURIComponent(incidentId)}`);
    return this.mapIncident(payload, incidentId);
  }

  async searchIncidents(query: CadSearchQuery): Promise<CadIncident[]> {
    await this.ensureConfigured();
    const search = new URLSearchParams();
    if (query.q) search.set("q", query.q);
    if (query.status) search.set("status", query.status);
    if (query.from) search.set("from", query.from);
    if (query.to) search.set("to", query.to);
    if (query.limit) search.set("limit", String(query.limit));
    const suffix = search.toString();
    const payload = await this.request(`/incidents${suffix ? `?${suffix}` : ""}`);

    if (!Array.isArray(payload)) {
      throw new Error("Malformed CAD response: incidents list must be an array.");
    }

    return payload.map((item, index) => this.mapIncident(item, `motorola-incident-${index}`));
  }

  async getUnit(unitId: string): Promise<MotorolaUnit> {
    await this.ensureConfigured();
    if (!unitId.trim()) {
      throw new Error("unitId is required.");
    }
    const payload = await this.request(`/units/${encodeURIComponent(unitId)}`);
    if (!payload || typeof payload !== "object") {
      throw new Error("Malformed CAD response: unit payload missing.");
    }
    return payload as MotorolaUnit;
  }

  async listActiveUnits(): Promise<MotorolaUnit[]> {
    await this.ensureConfigured();
    const payload = await this.request("/units?status=active");
    if (!Array.isArray(payload)) {
      throw new Error("Malformed CAD response: active units payload must be an array.");
    }
    return payload as MotorolaUnit[];
  }

  async createDraftUpdate(_input: CadDraftUpdateInput): Promise<CadDraftUpdate> {
    throw new Error("CAD write operations are disabled for read-only pilot.");
  }

  async submitApprovedUpdate(_input: CadApprovedUpdateInput): Promise<CadWriteResult> {
    throw new Error("CAD write operations are disabled for read-only pilot.");
  }

  private async ensureConfigured(): Promise<void> {
    if (!this.baseUrl) {
      throw new Error("CAD_API_BASE_URL is required for Motorola CAD adapter.");
    }
    if (!this.apiKey) {
      throw new Error("CAD_API_KEY is required for Motorola CAD adapter.");
    }
  }

  private async request(path: string): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: {
          accept: "application/json",
          "x-api-key": this.apiKey,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`CAD request failed: ${response.status} ${response.statusText}`);
      }

      try {
        return await response.json();
      } catch {
        throw new Error("Malformed CAD response: expected valid JSON.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`CAD request timeout after ${this.timeoutMs}ms.`);
      }
      if (error instanceof Error) {
        throw new Error(`CAD request error: ${error.message}`);
      }
      throw new Error("CAD request error.");
    } finally {
      clearTimeout(timeout);
    }
  }

  private mapIncident(raw: unknown, fallbackId: string): CadIncident {
    if (!raw || typeof raw !== "object") {
      throw new Error("Malformed CAD response: incident object missing.");
    }

    const candidate = raw as MotorolaIncident;
    return {
      incidentId: String(candidate.incidentId ?? candidate.id ?? fallbackId),
      status: typeof candidate.status === "string" ? candidate.status : undefined,
      callType: typeof candidate.callType === "string" ? candidate.callType : undefined,
      location: typeof candidate.location === "string" ? candidate.location : undefined,
      units: Array.isArray(candidate.units)
        ? candidate.units.filter((unit): unit is string => typeof unit === "string")
        : undefined,
      lastUpdatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : undefined,
      raw: candidate,
    };
  }
}
