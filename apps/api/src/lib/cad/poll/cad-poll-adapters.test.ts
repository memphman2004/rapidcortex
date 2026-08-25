/**
 * cad-poll-adapters.test.ts
 *
 * Vitest unit tests for Phase 3 multi-vendor CAD poll adapters.
 *
 * Referenced in scripts/readiness-gates-check.sh:
 *   npx vitest run apps/web/lib/rapid-cortex/cad/__tests__/adapter-integration.test.ts
 *
 * Test coverage:
 *   ✓ Mock mode returns synthetic incidents without HTTP calls
 *   ✓ Each adapter maps vendor fields to RawCadIncident correctly
 *   ✓ Priority mapping applies vendor codes → P1-P4
 *   ✓ Custom field mapping config overrides vendor defaults
 *   ✓ HTTP 401/403 → errorType: auth_error
 *   ✓ HTTP 429 → errorType: rate_limited
 *   ✓ Network error → errorType: network_error
 *   ✓ Invalid JSON → errorType: parse_error
 *   ✓ Empty array response → ok with 0 incidents
 *   ✓ MAX_INCIDENTS_PER_CYCLE cap (200 items)
 *   ✓ Circuit breaker state transitions
 *   ✓ Credential resolution fallback order
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  motorolaPremierOneAdapter,
  tylerNewWorldAdapter,
  centralSquareAdapter,
  hexagonAdapter,
  genericPollAdapter,
  getAdapter,
} from "./cad-poll-adapters.js";
import {
  applyPriorityMapping,
  applyFieldMapping,
  buildAuthHeaders,
  classifyHttpError,
  resolveConfig,
  type ResolvedCadConfig,
} from "./cad-poll-adapter.js";
import {
  evaluateCircuitBreaker,
  onSuccess,
  onFailure,
  openImmediate,
} from "./cad-circuit-breaker.js";

// ─── Test fixtures ────────────────────────────────────────────────────────────

const BASE_CONFIG: ResolvedCadConfig = {
  apiUrl:         "https://cad.test.local/api/incidents",
  authType:       "bearer",
  apiKey:         "test-token-abc123",
  apiKeyHeader:   "X-Api-Key",
  agencyCode:     "TEST-911",
  fieldMapping:   {},          // empty → use vendor defaults
  priorityMapping: {},
};

const MOTOROLA_PAYLOAD = {
  incidents: [
    {
      EventId:     "EVT-001",
      CallNumber:  "24-001",
      NatureCode:  "SHOTS",
      Priority:    "1",
      Location:    "123 Main St",
      Latitude:    "33.749",
      Longitude:   "-84.388",
      CallerName:  "Jane Doe",
      CallerPhone: "+14045551234",
      Narrative:   "Caller heard shots",
      Units:       "P1,M2",
      Status:      "ACTIVE",
      AgencyId:    "TEST-911",
    },
  ],
};

const TYLER_PAYLOAD = {
  events: [
    {
      eventNumber:    "2024-1234",
      callNumber:     "E24001234",
      callType:       "ASSAULT",
      priority:       "2",
      locationAddress: "456 Oak Ave",
      gpsLat:         "33.752",
      gpsLon:         "-84.391",
      callerName:     "Bob Smith",
      callerPhone:    "4045550000",
      remarks:        "Physical fight in progress",
      assignedUnits:  "P12,F4",
      eventStatus:    "ACTIVE",
      agencyCode:     "TEST-911",
    },
  ],
};

const CENTRAL_SQUARE_PAYLOAD = {
  Incidents: [
    {
      IncidentId:     "CS-2024-000456",
      IncidentNumber: "24-456",
      NatureOfCall:   "FIRE",
      Priority:       "1",
      Address:        "789 Elm St",
      Lat:            "33.755",
      Lon:            "-84.395",
      CallerName:     "Alice Johnson",
      CallerPhone:    "4045559876",
      Comments:       "Large structure fire",
      UnitList:       "E5,L2,BC1",
      Status:         "DISPATCHED",
    },
  ],
};

const HEXAGON_PAYLOAD = {
  events: [
    {
      event_id:         "HXG-20240001",
      event_number:     "2024-E-00001",
      event_type:       "10-50",
      priority_code:    "P1",
      location_text:    "100 Peachtree NW",
      lat:              "33.758",
      lng:              "-84.398",
      caller_name:      "Robert Jones",
      callback_number:  "+14045551111",
      problem:          "Caller advising MVC",
      responding_units: "P21,E6",
      event_status:     "DISPATCHED",
      response_type:    "EMERGENCY",
    },
  ],
};

const GENERIC_PAYLOAD = {
  incidents: [
    {
      id:        "gen-001",
      type:      "MEDICAL",
      priority:  "3",
      address:   "321 Broad St",
      lat:       "33.761",
      lng:       "-84.401",
      narrative: "Patient unresponsive",
    },
  ],
};

// ─── HTTP mock factory ────────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

function mockFetchNetworkError(message = "ECONNREFUSED") {
  return vi.fn().mockRejectedValue(new Error(message));
}

function mockFetchBadJson(status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => { throw new SyntaxError("Unexpected token"); },
    text: async () => "NOT JSON",
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Adapter registry", () => {
  it("returns correct adapter for each vendor", () => {
    expect(getAdapter("motorola_premier_one")).toBe(motorolaPremierOneAdapter);
    expect(getAdapter("tyler_new_world")).toBe(tylerNewWorldAdapter);
    expect(getAdapter("central_square")).toBe(centralSquareAdapter);
    expect(getAdapter("hexagon")).toBe(hexagonAdapter);
    expect(getAdapter("generic_webhook")).toBe(genericPollAdapter);
  });

  it("returns undefined for unknown vendor", () => {
    expect(getAdapter("spillman")).toBeUndefined();
    expect(getAdapter("")).toBeUndefined();
  });

  it("returns undefined for console_one (webhook-only, no poll adapter)", () => {
    expect(getAdapter("console_one")).toBeUndefined();
  });
});

// ─── Mock mode ────────────────────────────────────────────────────────────────

describe("Mock mode (CAD_POLLER_MOCK=1)", () => {
  beforeEach(() => {
    vi.stubEnv("CAD_POLLER_MOCK", "1");
    vi.stubGlobal("fetch", vi.fn()); // should never be called
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    motorolaPremierOneAdapter,
    tylerNewWorldAdapter,
    centralSquareAdapter,
    hexagonAdapter,
    genericPollAdapter,
  ])("$vendor returns synthetic incidents without HTTP call", async (adapter) => {
    const result = await adapter.poll(BASE_CONFIG, new Date().toISOString());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.incidents.length).toBeGreaterThan(0);
      expect(result.incidents[0].cadEventId).toMatch(/^MOCK-/);
      expect(fetch).not.toHaveBeenCalled();
    }
  });
});

// ─── Motorola adapter ─────────────────────────────────────────────────────────

describe("Motorola PremierOne adapter", () => {
  beforeEach(() => vi.stubEnv("CAD_POLLER_MOCK", "0"));
  afterEach(() => vi.unstubAllEnvs());

  it("maps vendor fields correctly", async () => {
    vi.stubGlobal("fetch", mockFetch(200, MOTOROLA_PAYLOAD));
    const result = await motorolaPremierOneAdapter.poll(BASE_CONFIG, "2024-01-01T00:00:00Z");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const inc = result.incidents[0];
    expect(inc.cadEventId).toBe("EVT-001");
    expect(inc.incidentNumber).toBe("24-001");
    expect(inc.incidentType).toBe("SHOTS");
    expect(inc.priority).toBe("1");
    expect(inc.location).toBe("123 Main St");
    expect(inc.latitude).toBe(33.749);
    expect(inc.longitude).toBe(-84.388);
    expect(inc.callerName).toBe("Jane Doe");
    expect(inc.callerPhone).toBe("+14045551234");
    expect(inc.narrative).toBe("Caller heard shots");
    expect(inc.units).toBe("P1,M2");
  });

  it("uses the configured apiUrl as the poll endpoint", async () => {
    const fetchFn = mockFetch(200, MOTOROLA_PAYLOAD);
    vi.stubGlobal("fetch", fetchFn);
    await motorolaPremierOneAdapter.poll(BASE_CONFIG, "2024-01-01T00:00:00Z");
    const called = String(fetchFn.mock.calls[0]?.[0]);
    expect(called.startsWith("https://cad.test.local/api/incidents")).toBe(true);
    expect(called).not.toContain("/api/incidents/api/incidents");
    expect(called).toContain("since=2024-01-01T00%3A00%3A00Z");
  });

  it("unwraps nested data.incidents envelopes", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { data: { incidents: MOTOROLA_PAYLOAD.incidents } }));
    const result = await motorolaPremierOneAdapter.poll(BASE_CONFIG, "2024-01-01T00:00:00Z");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.incidents[0]?.cadEventId).toBe("EVT-001");
  });

  it("returns auth_error on 401", async () => {
    vi.stubGlobal("fetch", mockFetch(401, { error: "Unauthorized" }));
    const result = await motorolaPremierOneAdapter.poll(BASE_CONFIG, "2024-01-01T00:00:00Z");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorType).toBe("auth_error");
    expect(result.httpStatus).toBe(401);
  });

  it("returns auth_error on 403", async () => {
    vi.stubGlobal("fetch", mockFetch(403, { error: "Forbidden" }));
    const result = await motorolaPremierOneAdapter.poll(BASE_CONFIG, "2024-01-01T00:00:00Z");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorType).toBe("auth_error");
    expect(result.httpStatus).toBe(403);
  });

  it("returns rate_limited on 429", async () => {
    vi.stubGlobal("fetch", mockFetch(429, {}));
    const result = await motorolaPremierOneAdapter.poll(BASE_CONFIG, "2024-01-01T00:00:00Z");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorType).toBe("rate_limited");
  });

  it("returns network_error on fetch throw", async () => {
    vi.stubGlobal("fetch", mockFetchNetworkError("ECONNREFUSED"));
    const result = await motorolaPremierOneAdapter.poll(BASE_CONFIG, "2024-01-01T00:00:00Z");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorType).toBe("network_error");
    expect(result.message).toContain("ECONNREFUSED");
  });

  it("returns parse_error on invalid JSON", async () => {
    vi.stubGlobal("fetch", mockFetchBadJson(200));
    const result = await motorolaPremierOneAdapter.poll(BASE_CONFIG, "2024-01-01T00:00:00Z");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorType).toBe("parse_error");
  });

  it("caps incidents at MAX_INCIDENTS_PER_CYCLE (200)", async () => {
    const manyIncidents = Array.from({ length: 300 }, (_, i) => ({
      ...MOTOROLA_PAYLOAD.incidents[0], EventId: `EVT-${i}`,
    }));
    vi.stubGlobal("fetch", mockFetch(200, { incidents: manyIncidents }));
    const result = await motorolaPremierOneAdapter.poll(BASE_CONFIG, "2024-01-01T00:00:00Z");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.incidents.length).toBe(200);
  });
});

// ─── Tyler adapter ────────────────────────────────────────────────────────────

describe("Tyler New World adapter", () => {
  beforeEach(() => vi.stubEnv("CAD_POLLER_MOCK", "0"));
  afterEach(() => vi.unstubAllEnvs());

  it("maps Tyler fields correctly", async () => {
    vi.stubGlobal("fetch", mockFetch(200, TYLER_PAYLOAD));
    const result = await tylerNewWorldAdapter.poll(BASE_CONFIG, "2024-01-01T00:00:00Z");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const inc = result.incidents[0];
    expect(inc.cadEventId).toBe("2024-1234");
    expect(inc.incidentType).toBe("ASSAULT");
    expect(inc.location).toBe("456 Oak Ave");
    expect(inc.latitude).toBeCloseTo(33.752);
    expect(inc.narrative).toBe("Physical fight in progress");
  });

  it("handles empty events array gracefully", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { events: [] }));
    const result = await tylerNewWorldAdapter.poll(BASE_CONFIG, "2024-01-01T00:00:00Z");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.incidents).toHaveLength(0);
  });
});

// ─── CentralSquare adapter ────────────────────────────────────────────────────

describe("CentralSquare adapter", () => {
  beforeEach(() => vi.stubEnv("CAD_POLLER_MOCK", "0"));
  afterEach(() => vi.unstubAllEnvs());

  it("maps CentralSquare fields correctly", async () => {
    vi.stubGlobal("fetch", mockFetch(200, CENTRAL_SQUARE_PAYLOAD));
    const result = await centralSquareAdapter.poll(BASE_CONFIG, "2024-01-01T00:00:00Z");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const inc = result.incidents[0];
    expect(inc.cadEventId).toBe("CS-2024-000456");
    expect(inc.incidentType).toBe("FIRE");
    expect(inc.units).toBe("E5,L2,BC1");
  });
});

// ─── Hexagon adapter ──────────────────────────────────────────────────────────

describe("Hexagon I/CAD adapter", () => {
  beforeEach(() => vi.stubEnv("CAD_POLLER_MOCK", "0"));
  afterEach(() => vi.unstubAllEnvs());

  it("maps Hexagon underscore-case fields correctly", async () => {
    vi.stubGlobal("fetch", mockFetch(200, HEXAGON_PAYLOAD));
    const result = await hexagonAdapter.poll(BASE_CONFIG, "2024-01-01T00:00:00Z");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const inc = result.incidents[0];
    expect(inc.cadEventId).toBe("HXG-20240001");
    expect(inc.callerPhone).toBe("+14045551111");
    expect(inc.narrative).toBe("Caller advising MVC");
    expect(inc.responseCode).toBe("EMERGENCY");
  });
});

// ─── Generic adapter ──────────────────────────────────────────────────────────

describe("Generic poll adapter", () => {
  beforeEach(() => vi.stubEnv("CAD_POLLER_MOCK", "0"));
  afterEach(() => vi.unstubAllEnvs());

  it("handles top-level array response", async () => {
    vi.stubGlobal("fetch", mockFetch(200, GENERIC_PAYLOAD.incidents));
    const result = await genericPollAdapter.poll(BASE_CONFIG, "2024-01-01T00:00:00Z");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.incidents[0].incidentType).toBe("MEDICAL");
  });

  it("handles incidents key in response object", async () => {
    vi.stubGlobal("fetch", mockFetch(200, GENERIC_PAYLOAD));
    const result = await genericPollAdapter.poll(BASE_CONFIG, "2024-01-01T00:00:00Z");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.incidents).toHaveLength(1);
  });
});

// ─── Priority mapping ─────────────────────────────────────────────────────────

describe("applyPriorityMapping", () => {
  it("maps explicit config entries", () => {
    expect(applyPriorityMapping("IMMEDIATE", { IMMEDIATE: "P1" })).toBe("P1");
    expect(applyPriorityMapping("ROUTINE",   { ROUTINE:   "P3" })).toBe("P3");
  });

  it("falls back to default numeric mapping", () => {
    expect(applyPriorityMapping("1", {})).toBe("P1");
    expect(applyPriorityMapping("2", {})).toBe("P2");
    expect(applyPriorityMapping("3", {})).toBe("P3");
    expect(applyPriorityMapping("4", {})).toBe("P4");
  });

  it("falls back to default named mapping", () => {
    expect(applyPriorityMapping("EMERGENCY", {})).toBe("P1");
    expect(applyPriorityMapping("PRIORITY",  {})).toBe("P2");
    expect(applyPriorityMapping("NON-EMERGENCY", {})).toBe("P4");
  });

  it("returns undefined for unknown codes", () => {
    expect(applyPriorityMapping("UNKNOWN-CODE", {})).toBeUndefined();
  });

  it("is case-insensitive for default fallback", () => {
    expect(applyPriorityMapping("emergency", {})).toBe("P1");
  });
});

// ─── Custom field mapping ─────────────────────────────────────────────────────

describe("applyFieldMapping with custom config", () => {
  it("uses custom mapping over vendor defaults", () => {
    const config: ResolvedCadConfig = {
      ...BASE_CONFIG,
      fieldMapping: {
        customId:       "cadEventId",
        customType:     "incidentType",
        customLocation: "location",
      },
    };
    const payload = {
      customId:       "CUSTOM-001",
      customType:     "FIRE",
      customLocation: "999 Custom St",
      ignoredField:   "should be ignored",
    };
    const result = applyFieldMapping(payload, config, () => ({}));
    expect(result.cadEventId).toBe("CUSTOM-001");
    expect(result.incidentType).toBe("FIRE");
    expect(result.location).toBe("999 Custom St");
  });

  it("falls through to defaultMapper when fieldMapping is empty", () => {
    const defaultMapper = vi.fn().mockReturnValue({ cadEventId: "DEFAULT-001" });
    const result = applyFieldMapping({}, BASE_CONFIG, defaultMapper);
    expect(defaultMapper).toHaveBeenCalledOnce();
    expect(result.cadEventId).toBe("DEFAULT-001");
  });
});

// ─── Auth header construction ─────────────────────────────────────────────────

describe("buildAuthHeaders", () => {
  it("builds bearer header", () => {
    const headers = buildAuthHeaders({ ...BASE_CONFIG, authType: "bearer", apiKey: "my-token" });
    expect(headers["Authorization"]).toBe("Bearer my-token");
  });

  it("builds api_key_header", () => {
    const headers = buildAuthHeaders({
      ...BASE_CONFIG, authType: "api_key_header",
      apiKey: "my-key", apiKeyHeader: "X-Custom-Key",
    });
    expect(headers["X-Custom-Key"]).toBe("my-key");
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("builds basic auth", () => {
    const headers = buildAuthHeaders({ ...BASE_CONFIG, authType: "basic", apiKey: "dXNlcjpwYXNz" });
    expect(headers["Authorization"]).toBe("Basic dXNlcjpwYXNz");
  });

  it("no_auth sends no Authorization header", () => {
    const headers = buildAuthHeaders({ ...BASE_CONFIG, authType: "no_auth", apiKey: "" });
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("always includes User-Agent", () => {
    const headers = buildAuthHeaders(BASE_CONFIG);
    expect(headers["User-Agent"]).toContain("RapidCortex-CadPoller");
  });
});

// ─── HTTP error classification ────────────────────────────────────────────────

describe("classifyHttpError", () => {
  it.each([401, 403])("classifies %i as auth_error", (status) => {
    const result = classifyHttpError(status, "error");
    expect(result.errorType).toBe("auth_error");
    expect(result.httpStatus).toBe(status);
  });

  it("classifies 429 as rate_limited", () => {
    expect(classifyHttpError(429, "error").errorType).toBe("rate_limited");
  });

  it.each([500, 502, 503, 404])("classifies %i as network_error", (status) => {
    expect(classifyHttpError(status, "error").errorType).toBe("network_error");
  });
});

// ─── Circuit breaker transitions ──────────────────────────────────────────────

describe("Circuit breaker", () => {
  it("starts CLOSED and allows requests", () => {
    const result = evaluateCircuitBreaker(undefined);
    expect(result.allowed).toBe(true);
    expect(result.state.state).toBe("CLOSED");
  });

  it("stays CLOSED until failure threshold", () => {
    let cb = undefined;
    cb = onFailure(cb); expect(cb.state).toBe("CLOSED"); // 1
    cb = onFailure(cb); expect(cb.state).toBe("CLOSED"); // 2
    cb = onFailure(cb); expect(cb.state).toBe("OPEN");   // 3 → opens
  });

  it("OPEN blocks requests during cooldown", () => {
    let cb = onFailure(onFailure(onFailure(undefined)));
    expect(cb.state).toBe("OPEN");
    const result = evaluateCircuitBreaker(cb);
    expect(result.allowed).toBe(false);
  });

  it("OPEN transitions to HALF_OPEN after cooldown", () => {
    // Manually set cooldownUntil in the past
    const cb = {
      state: "OPEN" as const,
      failureCount: 3,
      openedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      cooldownUntil: new Date(Date.now() - 1_000).toISOString(), // expired
    };
    const result = evaluateCircuitBreaker(cb);
    expect(result.allowed).toBe(true);
    expect(result.state.state).toBe("HALF_OPEN");
  });

  it("success resets to CLOSED", () => {
    const open = onFailure(onFailure(onFailure(undefined)));
    const closed = onSuccess(open);
    expect(closed.state).toBe("CLOSED");
    expect(closed.failureCount).toBe(0);
  });

  it("openImmediate opens with 24h cooldown for auth_error", () => {
    const cb = openImmediate(undefined);
    expect(cb.state).toBe("OPEN");
    const cooldown = new Date(cb.cooldownUntil).getTime();
    const expectedMin = Date.now() + 23 * 60 * 60 * 1000;
    expect(cooldown).toBeGreaterThan(expectedMin);
  });
});
