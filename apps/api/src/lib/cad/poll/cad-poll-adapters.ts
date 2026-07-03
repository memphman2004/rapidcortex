/**
 * cad-poll-adapters.ts
 *
 * Concrete adapter implementations for each supported CAD vendor.
 *
 * Each adapter:
 *   1. Builds the vendor-specific HTTP request (URL, auth headers, query params)
 *   2. Parses the response body (which varies significantly per vendor)
 *   3. Normalizes each event into RawCadIncident via field mapping config
 *   4. Returns PollResult — no side effects, no DDB writes
 *
 * All adapters respect CAD_POLLER_MOCK=1 and return synthetic incidents
 * without making any outbound HTTP calls. This is the dev/staging behavior.
 *
 * Pagination:
 *   Motorola:     page-based (page, pageSize params)
 *   Tyler:        since-based cursor (eventsSince param)
 *   CentralSquare: modifiedSince ISO param
 *   Hexagon:      timestamp-based (since param)
 *   Generic:      configurable (since param)
 *
 *   All adapters fetch at most 200 incidents per poll cycle to prevent
 *   runaway memory growth in Lambda. High-volume agencies should use
 *   webhook inbound instead of api_poll.
 */

import type {
  CadPollAdapter,
  ResolvedCadConfig,
  PollResult,
  RawCadIncident,
} from "./cad-poll-adapter.js";
import {
  buildAuthHeaders,
  classifyHttpError,
  applyFieldMapping,
  applyPriorityMapping,
  extractField,
} from "./cad-poll-adapter.js";

const MAX_INCIDENTS_PER_CYCLE = 200;
const FETCH_TIMEOUT_MS = 15_000;

// ─── Mock support ─────────────────────────────────────────────────────────────

function isMockMode(): boolean {
  return process.env.CAD_POLLER_MOCK === "1";
}

function buildMockIncidents(vendor: string, count = 2): RawCadIncident[] {
  const now = new Date().toISOString();
  return Array.from({ length: count }, (_, i) => ({
    cadEventId: `MOCK-${vendor.toUpperCase()}-${Date.now()}-${i}`,
    incidentNumber: `MOCK-${i + 1}`,
    incidentType: i % 2 === 0 ? "ASSLT" : "MVC",
    priority: "1",
    rcPriority: "P1" as const,
    location: `${100 + i} Mock Street, Test City`,
    latitude: 33.749 + i * 0.001,
    longitude: -84.388 + i * 0.001,
    callerName: `Mock Caller ${i + 1}`,
    callerPhone: `+15555550${i}0${i}`,
    narrative: `[MOCK] ${vendor} test incident ${i + 1}`,
    units: `P${i + 1}`,
    status: "ACTIVE",
    rawPayload: { source: "mock", vendor, index: i },
    receivedAt: now,
  }));
}

// ─── Fetch wrapper ────────────────────────────────────────────────────────────

async function timedFetch(
  url: string,
  options: RequestInit,
): Promise<{ response: Response; latencyMs: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const start = Date.now();
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return { response, latencyMs: Date.now() - start };
  } finally {
    clearTimeout(timer);
  }
}

// ─── 1. Motorola PremierOne adapter ──────────────────────────────────────────

export const motorolaPremierOneAdapter: CadPollAdapter = {
  vendor: "motorola_premier_one",

  async poll(config: ResolvedCadConfig, sinceIso: string): Promise<PollResult> {
    if (isMockMode()) {
      return { ok: true, incidents: buildMockIncidents("motorola"), latencyMs: 45, httpStatus: 200, nextSince: new Date().toISOString() };
    }

    const headers = buildAuthHeaders(config);
    // PremierOne uses since + pageSize; agencyCode scopes results
    const url = new URL(`${config.apiUrl}/api/incidents`);
    url.searchParams.set("since", sinceIso);
    url.searchParams.set("pageSize", "100");
    if (config.agencyCode) url.searchParams.set("agencyId", config.agencyCode);

    let latencyMs: number;
    let response: Response;
    try {
      ({ response, latencyMs } = await timedFetch(url.toString(), { method: "GET", headers }));
    } catch (e) {
      return { ok: false, errorType: "network_error", message: (e as Error).message, latencyMs: 0 };
    }

    if (!response.ok) {
      const error = classifyHttpError(response.status, `Motorola API returned ${response.status}`);
      return { ...error, latencyMs };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { ok: false, errorType: "parse_error", message: "Response is not valid JSON", latencyMs, httpStatus: response.status };
    }

    const raw = body as Record<string, unknown>;
    const items = (raw.incidents ?? raw.Events ?? raw.data ?? []) as Record<string, unknown>[];
    if (!Array.isArray(items)) {
      return { ok: false, errorType: "parse_error", message: "Expected array in response", latencyMs, httpStatus: response.status };
    }

    const now = new Date().toISOString();
    const incidents: RawCadIncident[] = items.slice(0, MAX_INCIDENTS_PER_CYCLE).map((item) => {
      const mapped = applyFieldMapping(item, config, (p) => ({
        cadEventId:     extractField(p, "EventId")    ?? extractField(p, "incidentId"),
        incidentNumber: extractField(p, "CallNumber") ?? extractField(p, "eventNumber"),
        incidentType:   extractField(p, "NatureCode") ?? extractField(p, "callType"),
        priority:       extractField(p, "Priority"),
        location:       extractField(p, "Location")   ?? extractField(p, "locationAddress"),
        latitude:       parseFloat(extractField(p, "Latitude") ?? "") || undefined,
        longitude:      parseFloat(extractField(p, "Longitude") ?? "") || undefined,
        callerName:     extractField(p, "CallerName"),
        callerPhone:    extractField(p, "CallerPhone"),
        narrative:      extractField(p, "Narrative"),
        units:          extractField(p, "Units"),
        status:         extractField(p, "Status"),
        agencyCode:     extractField(p, "AgencyId") ?? config.agencyCode,
      }));
      return {
        ...mapped,
        cadEventId: mapped.cadEventId ?? String(item.EventId ?? item.id ?? "unknown"),
        rcPriority: applyPriorityMapping(mapped.priority, config.priorityMapping),
        rawPayload: item,
        receivedAt: now,
      } as RawCadIncident;
    });

    return {
      ok: true,
      incidents,
      latencyMs,
      httpStatus: response.status,
      nextSince: new Date().toISOString(),
    };
  },
};

// ─── 2. Tyler New World adapter ───────────────────────────────────────────────

export const tylerNewWorldAdapter: CadPollAdapter = {
  vendor: "tyler_new_world",

  async poll(config: ResolvedCadConfig, sinceIso: string): Promise<PollResult> {
    if (isMockMode()) {
      return { ok: true, incidents: buildMockIncidents("tyler"), latencyMs: 62, httpStatus: 200, nextSince: new Date().toISOString() };
    }

    const headers = buildAuthHeaders(config);
    const url = new URL(config.apiUrl);
    url.searchParams.set("eventsSince", sinceIso);
    if (config.agencyCode) url.searchParams.set("agencyCode", config.agencyCode);
    url.searchParams.set("limit", "100");

    let response: Response;
    let latencyMs: number;
    try {
      ({ response, latencyMs } = await timedFetch(url.toString(), { method: "GET", headers }));
    } catch (e) {
      return { ok: false, errorType: "network_error", message: (e as Error).message, latencyMs: 0 };
    }

    if (!response.ok) {
      return { ...classifyHttpError(response.status, `Tyler API returned ${response.status}`), latencyMs };
    }

    let body: unknown;
    try { body = await response.json(); } catch {
      return { ok: false, errorType: "parse_error", message: "Invalid JSON", latencyMs, httpStatus: response.status };
    }

    const raw = body as Record<string, unknown>;
    const items = (raw.events ?? raw.incidents ?? raw.data ?? raw) as Record<string, unknown>[];
    if (!Array.isArray(items)) {
      return { ok: false, errorType: "parse_error", message: "Unexpected Tyler response shape", latencyMs, httpStatus: response.status };
    }

    const now = new Date().toISOString();
    const incidents: RawCadIncident[] = items.slice(0, MAX_INCIDENTS_PER_CYCLE).map((item) => {
      const mapped = applyFieldMapping(item, config, (p) => ({
        cadEventId:     extractField(p, "eventNumber") ?? extractField(p, "id"),
        incidentNumber: extractField(p, "callNumber"),
        incidentType:   extractField(p, "callType"),
        priority:       extractField(p, "priority"),
        location:       extractField(p, "locationAddress"),
        latitude:       parseFloat(extractField(p, "gpsLat") ?? "") || undefined,
        longitude:      parseFloat(extractField(p, "gpsLon") ?? "") || undefined,
        callerName:     extractField(p, "callerName"),
        callerPhone:    extractField(p, "callerPhone"),
        narrative:      extractField(p, "remarks"),
        units:          extractField(p, "assignedUnits"),
        status:         extractField(p, "eventStatus"),
        agencyCode:     extractField(p, "agencyCode") ?? config.agencyCode,
      }));
      return {
        ...mapped,
        cadEventId: mapped.cadEventId ?? String(item.eventNumber ?? item.id ?? "unknown"),
        rcPriority: applyPriorityMapping(mapped.priority, config.priorityMapping),
        rawPayload: item,
        receivedAt: now,
      } as RawCadIncident;
    });

    return { ok: true, incidents, latencyMs, httpStatus: response.status, nextSince: new Date().toISOString() };
  },
};

// ─── 3. CentralSquare adapter ─────────────────────────────────────────────────

export const centralSquareAdapter: CadPollAdapter = {
  vendor: "central_square",

  async poll(config: ResolvedCadConfig, sinceIso: string): Promise<PollResult> {
    if (isMockMode()) {
      return { ok: true, incidents: buildMockIncidents("central_square"), latencyMs: 55, httpStatus: 200, nextSince: new Date().toISOString() };
    }

    const headers = buildAuthHeaders(config);
    const url = new URL(config.apiUrl);
    url.searchParams.set("modifiedSince", sinceIso);
    if (config.agencyCode) url.searchParams.set("orgCode", config.agencyCode);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("page", "1");

    let response: Response;
    let latencyMs: number;
    try {
      ({ response, latencyMs } = await timedFetch(url.toString(), { method: "GET", headers }));
    } catch (e) {
      return { ok: false, errorType: "network_error", message: (e as Error).message, latencyMs: 0 };
    }

    if (!response.ok) {
      return { ...classifyHttpError(response.status, `CentralSquare API returned ${response.status}`), latencyMs };
    }

    let body: unknown;
    try { body = await response.json(); } catch {
      return { ok: false, errorType: "parse_error", message: "Invalid JSON", latencyMs, httpStatus: response.status };
    }

    const raw = body as Record<string, unknown>;
    const items = (raw.Incidents ?? raw.incidents ?? raw.results ?? raw.data ?? []) as Record<string, unknown>[];
    if (!Array.isArray(items)) {
      return { ok: false, errorType: "parse_error", message: "Unexpected CentralSquare shape", latencyMs, httpStatus: response.status };
    }

    const now = new Date().toISOString();
    const incidents: RawCadIncident[] = items.slice(0, MAX_INCIDENTS_PER_CYCLE).map((item) => {
      const mapped = applyFieldMapping(item, config, (p) => ({
        cadEventId:     extractField(p, "IncidentId"),
        incidentNumber: extractField(p, "IncidentNumber"),
        incidentType:   extractField(p, "NatureOfCall"),
        priority:       extractField(p, "Priority"),
        location:       extractField(p, "Address"),
        latitude:       parseFloat(extractField(p, "Lat") ?? "") || undefined,
        longitude:      parseFloat(extractField(p, "Lon") ?? "") || undefined,
        callerName:     extractField(p, "CallerName"),
        callerPhone:    extractField(p, "CallerPhone"),
        narrative:      extractField(p, "Comments"),
        units:          extractField(p, "UnitList"),
        status:         extractField(p, "Status"),
        agencyCode:     config.agencyCode,
      }));
      return {
        ...mapped,
        cadEventId: mapped.cadEventId ?? String(item.IncidentId ?? item.id ?? "unknown"),
        rcPriority: applyPriorityMapping(mapped.priority, config.priorityMapping),
        rawPayload: item,
        receivedAt: now,
      } as RawCadIncident;
    });

    return { ok: true, incidents, latencyMs, httpStatus: response.status, nextSince: new Date().toISOString() };
  },
};

// ─── 4. Hexagon I/CAD adapter ─────────────────────────────────────────────────

export const hexagonAdapter: CadPollAdapter = {
  vendor: "hexagon",

  async poll(config: ResolvedCadConfig, sinceIso: string): Promise<PollResult> {
    if (isMockMode()) {
      return { ok: true, incidents: buildMockIncidents("hexagon"), latencyMs: 71, httpStatus: 200, nextSince: new Date().toISOString() };
    }

    const headers = buildAuthHeaders(config);
    // Hexagon I/CAD Web Services uses unix timestamp for since
    const sinceUnix = Math.floor(new Date(sinceIso).getTime() / 1000);
    const url = new URL(config.apiUrl);
    url.searchParams.set("since", String(sinceUnix));
    if (config.agencyCode) url.searchParams.set("agencyCode", config.agencyCode);
    url.searchParams.set("maxResults", "100");

    let response: Response;
    let latencyMs: number;
    try {
      ({ response, latencyMs } = await timedFetch(url.toString(), { method: "GET", headers }));
    } catch (e) {
      return { ok: false, errorType: "network_error", message: (e as Error).message, latencyMs: 0 };
    }

    if (!response.ok) {
      return { ...classifyHttpError(response.status, `Hexagon API returned ${response.status}`), latencyMs };
    }

    let body: unknown;
    try { body = await response.json(); } catch {
      return { ok: false, errorType: "parse_error", message: "Invalid JSON", latencyMs, httpStatus: response.status };
    }

    const raw = body as Record<string, unknown>;
    const items = (raw.events ?? raw.incidents ?? raw.EventList ?? []) as Record<string, unknown>[];
    if (!Array.isArray(items)) {
      return { ok: false, errorType: "parse_error", message: "Unexpected Hexagon shape", latencyMs, httpStatus: response.status };
    }

    const now = new Date().toISOString();
    const incidents: RawCadIncident[] = items.slice(0, MAX_INCIDENTS_PER_CYCLE).map((item) => {
      const mapped = applyFieldMapping(item, config, (p) => ({
        cadEventId:     extractField(p, "event_id"),
        incidentNumber: extractField(p, "event_number"),
        incidentType:   extractField(p, "event_type"),
        priority:       extractField(p, "priority_code"),
        location:       extractField(p, "location_text"),
        latitude:       parseFloat(extractField(p, "lat") ?? "") || undefined,
        longitude:      parseFloat(extractField(p, "lng") ?? "") || undefined,
        callerName:     extractField(p, "caller_name"),
        callerPhone:    extractField(p, "callback_number"),
        narrative:      extractField(p, "problem"),
        units:          extractField(p, "responding_units"),
        status:         extractField(p, "event_status"),
        responseCode:   extractField(p, "response_type"),
        agencyCode:     config.agencyCode,
      }));
      return {
        ...mapped,
        cadEventId: mapped.cadEventId ?? String(item.event_id ?? item.id ?? "unknown"),
        rcPriority: applyPriorityMapping(mapped.priority, config.priorityMapping),
        rawPayload: item,
        receivedAt: now,
      } as RawCadIncident;
    });

    return { ok: true, incidents, latencyMs, httpStatus: response.status, nextSince: new Date().toISOString() };
  },
};

// ─── 5. Generic REST adapter ──────────────────────────────────────────────────

export const genericPollAdapter: CadPollAdapter = {
  vendor: "generic_webhook",

  async poll(config: ResolvedCadConfig, sinceIso: string): Promise<PollResult> {
    if (isMockMode()) {
      return { ok: true, incidents: buildMockIncidents("generic"), latencyMs: 38, httpStatus: 200, nextSince: new Date().toISOString() };
    }

    const headers = buildAuthHeaders(config);
    const url = new URL(config.apiUrl);
    url.searchParams.set("since", sinceIso);
    if (config.agencyCode) url.searchParams.set("agencyCode", config.agencyCode);

    let response: Response;
    let latencyMs: number;
    try {
      ({ response, latencyMs } = await timedFetch(url.toString(), { method: "GET", headers }));
    } catch (e) {
      return { ok: false, errorType: "network_error", message: (e as Error).message, latencyMs: 0 };
    }

    if (!response.ok) {
      return { ...classifyHttpError(response.status, `Generic API returned ${response.status}`), latencyMs };
    }

    let body: unknown;
    try { body = await response.json(); } catch {
      return { ok: false, errorType: "parse_error", message: "Invalid JSON", latencyMs, httpStatus: response.status };
    }

    // Generic adapter: try to find an array in the response
    const raw = body as Record<string, unknown>;
    const items = (
      Array.isArray(body)
        ? body
        : raw.incidents ?? raw.events ?? raw.data ?? raw.results ?? []
    ) as Record<string, unknown>[];

    if (!Array.isArray(items) || items.length === 0) {
      return { ok: true, incidents: [], latencyMs, httpStatus: response.status, nextSince: new Date().toISOString() };
    }

    const now = new Date().toISOString();
    const incidents: RawCadIncident[] = items.slice(0, MAX_INCIDENTS_PER_CYCLE).map((item) => {
      const mapped = applyFieldMapping(item, config, (p) => ({
        cadEventId:   extractField(p, "id")      ?? extractField(p, "eventId"),
        incidentType: extractField(p, "type")     ?? extractField(p, "incidentType"),
        priority:     extractField(p, "priority"),
        location:     extractField(p, "address")  ?? extractField(p, "location"),
        latitude:     parseFloat(extractField(p, "lat") ?? extractField(p, "latitude") ?? "") || undefined,
        longitude:    parseFloat(extractField(p, "lng") ?? extractField(p, "longitude") ?? "") || undefined,
        narrative:    extractField(p, "narrative") ?? extractField(p, "notes"),
      }));
      return {
        ...mapped,
        cadEventId: mapped.cadEventId ?? String(item.id ?? item.eventId ?? `generic-${Date.now()}`),
        rcPriority: applyPriorityMapping(mapped.priority, config.priorityMapping),
        rawPayload: item,
        receivedAt: now,
      } as RawCadIncident;
    });

    return { ok: true, incidents, latencyMs, httpStatus: response.status, nextSince: new Date().toISOString() };
  },
};

// ─── Adapter registry ─────────────────────────────────────────────────────────

export const ADAPTER_REGISTRY = new Map<string, CadPollAdapter>([
  ["motorola_premier_one", motorolaPremierOneAdapter],
  ["tyler_new_world",      tylerNewWorldAdapter],
  ["central_square",       centralSquareAdapter],
  ["hexagon",              hexagonAdapter],
  ["generic_webhook",      genericPollAdapter],
  // console_one uses webhook_inbound only — no poll adapter
]);

export function getAdapter(vendor: string): CadPollAdapter | undefined {
  return ADAPTER_REGISTRY.get(vendor);
}
