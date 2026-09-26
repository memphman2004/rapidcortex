import type { FourwindsDispatchResult, FourwindsEmergencyPayload } from "./types.js";

export type FourwindsClientConfig = {
  baseUrl: string;
  apiKey: string;
  clientId?: string;
  mock?: boolean;
  fetchImpl?: typeof fetch;
};

function defaultFetch(): typeof fetch {
  if (typeof fetch !== "undefined") return fetch;
  throw new Error("fetch is not available");
}

/**
 * Four Winds digital signage REST adapter (SOC-024 emergency takeover, SOC-025 all-clear).
 * HTML5 fallback path supports off-network displays per institutional agreement language.
 */
export class FourwindsClient {
  private readonly cfg: FourwindsClientConfig;

  constructor(cfg: FourwindsClientConfig) {
    this.cfg = cfg;
  }

  async activateEmergency(payload: FourwindsEmergencyPayload): Promise<FourwindsDispatchResult> {
    if (this.cfg.mock || !this.cfg.baseUrl) {
      return {
        ok: true,
        mocked: true,
        providerRequestId: `mock-fw-${payload.incidentId}`,
        html5FallbackIssued: Boolean(payload.html5FallbackUrl),
      };
    }
    const fetchFn = this.cfg.fetchImpl ?? defaultFetch();
    const url = `${this.cfg.baseUrl.replace(/\/$/, "")}/api/v1/emergency/active`;
    try {
      const res = await fetchFn(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.cfg.apiKey,
          ...(this.cfg.clientId ? { "x-client-id": this.cfg.clientId } : {}),
        },
        body: JSON.stringify({
          externalIncidentId: payload.incidentId,
          headline: payload.title,
          message: payload.body,
          severity: payload.severity,
          scopes: payload.scopes,
          html5FallbackUrl: payload.html5FallbackUrl,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false, mocked: false, error: text || `HTTP ${res.status}` };
      }
      const data = (await res.json().catch(() => ({}))) as { requestId?: string };
      let html5FallbackIssued = false;
      if (payload.html5FallbackUrl) {
        html5FallbackIssued = await this.pushHtml5Fallback(payload);
      }
      return {
        ok: true,
        mocked: false,
        providerRequestId: data.requestId,
        html5FallbackIssued,
      };
    } catch (err) {
      return {
        ok: false,
        mocked: false,
        error: err instanceof Error ? err.message : "Fourwinds request failed",
      };
    }
  }

  async clearEmergency(payload: FourwindsEmergencyPayload): Promise<FourwindsDispatchResult> {
    if (this.cfg.mock || !this.cfg.baseUrl) {
      return { ok: true, mocked: true, providerRequestId: `mock-fw-clear-${payload.incidentId}` };
    }
    const fetchFn = this.cfg.fetchImpl ?? defaultFetch();
    const url = `${this.cfg.baseUrl.replace(/\/$/, "")}/api/v1/emergency/clear`;
    try {
      const res = await fetchFn(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.cfg.apiKey,
          ...(this.cfg.clientId ? { "x-client-id": this.cfg.clientId } : {}),
        },
        body: JSON.stringify({
          externalIncidentId: payload.incidentId,
          scopes: payload.scopes,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false, mocked: false, error: text || `HTTP ${res.status}` };
      }
      const data = (await res.json().catch(() => ({}))) as { requestId?: string };
      return { ok: true, mocked: false, providerRequestId: data.requestId };
    } catch (err) {
      return {
        ok: false,
        mocked: false,
        error: err instanceof Error ? err.message : "Fourwinds clear failed",
      };
    }
  }

  async pushHtml5Fallback(payload: FourwindsEmergencyPayload): Promise<boolean> {
    if (!payload.html5FallbackUrl) return false;
    if (this.cfg.mock || !this.cfg.baseUrl) return true;
    const fetchFn = this.cfg.fetchImpl ?? defaultFetch();
    const url = `${this.cfg.baseUrl.replace(/\/$/, "")}/api/v1/fallback/html5`;
    try {
      const res = await fetchFn(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.cfg.apiKey,
          ...(this.cfg.clientId ? { "x-client-id": this.cfg.clientId } : {}),
        },
        body: JSON.stringify({
          externalIncidentId: payload.incidentId,
          fallbackUrl: payload.html5FallbackUrl,
          scopes: payload.scopes,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export function fourwindsMockEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.FOURWINDS_MOCK === "1" || env.FOURWINDS_MOCK === "true";
}
