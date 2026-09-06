import { describe, expect, it } from "vitest";
import { CadRoutingEngine } from "../services/CadRoutingEngine.js";
import type { CadConnectorConfig, CadWriteBackRequest, UnifiedCadIncident } from "rapid-cortex-shared";

function connector(over: Partial<CadConnectorConfig> = {}): CadConnectorConfig {
  return {
    connectorId: "cadc_law",
    agencyId: "test-agency",
    vendorId: "motorola_premierone",
    displayName: "Law CAD",
    department: "law_enforcement",
    enabled: true,
    connectionMode: "polling",
    pollingIntervalSeconds: 60,
    credentials: { authType: "api_key", secretArn: "arn:aws:secretsmanager:us-east-1:000000000000:secret:mock" },
    fieldMappings: [],
    routingRules: [],
    lastHealthCheck: { connectorId: "cadc_law", status: "healthy", checkedAt: new Date().toISOString() },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdByUserId: "seed",
    ...over,
  };
}

function incident(over: Partial<UnifiedCadIncident> = {}): UnifiedCadIncident {
  return {
    unifiedId: "ucad_1",
    agencyId: "test-agency",
    connectorId: "cadc_law",
    vendorId: "motorola_premierone",
    department: "law_enforcement",
    vendorIncidentId: "1",
    incidentType: "ROBBERY",
    priority: 1,
    status: "dispatched",
    units: [],
    dedupeKey: "x",
    isDuplicate: false,
    ingestedAt: new Date().toISOString(),
    lastSyncAt: new Date().toISOString(),
    schemaVersion: 1,
    ...over,
  };
}

const writeBack: CadWriteBackRequest = {
  writeBackId: "cwb_1",
  agencyId: "test-agency",
  unifiedId: "ucad_1",
  requestedByUserId: "u1",
  requestedAt: new Date().toISOString(),
  status: "pending_routing",
  payload: { action: "add_narrative", fields: {}, narrative: "note" },
  auditTrail: [],
};

describe("CadRoutingEngine", () => {
  it("matches department eq", () => {
    const law = connector();
    const fire = connector({
      connectorId: "cadc_fire",
      department: "fire",
      displayName: "Fire CAD",
    });
    const rules = [
      {
        ruleId: "r1",
        priority: 1,
        description: "law",
        conditions: [{ field: "department" as const, operator: "eq" as const, value: "law_enforcement" as const }],
        targetConnectorId: "cadc_law",
        requireSupervisorApproval: true,
        enabled: true,
      },
    ];
    const result = CadRoutingEngine.resolve(writeBack, [law, fire], incident(), rules);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.connectorId).toBe("cadc_law");
  });

  it("returns no_route when nothing matches", () => {
    const result = CadRoutingEngine.resolve(writeBack, [connector()], incident(), []);
    expect(result).toEqual({ ok: false, reason: "no_route" });
  });

  it("blocks disabled connectors", () => {
    const law = connector({ enabled: false });
    const rules = [
      {
        ruleId: "r1",
        priority: 1,
        description: "all",
        conditions: [],
        targetConnectorId: "cadc_law",
        requireSupervisorApproval: true,
        enabled: true,
      },
    ];
    expect(CadRoutingEngine.resolve(writeBack, [law], incident(), rules)).toEqual({
      ok: false,
      reason: "connector_disabled",
    });
  });

  it("blocks unhealthy connectors", () => {
    const law = connector({
      lastHealthCheck: { connectorId: "cadc_law", status: "degraded", checkedAt: new Date().toISOString() },
    });
    const rules = [
      {
        ruleId: "r1",
        priority: 1,
        description: "all",
        conditions: [],
        targetConnectorId: "cadc_law",
        requireSupervisorApproval: true,
        enabled: true,
      },
    ];
    expect(CadRoutingEngine.resolve(writeBack, [law], incident(), rules)).toEqual({
      ok: false,
      reason: "connector_unhealthy",
    });
  });

  it("matches incidentType in, zone eq, and priority gte", () => {
    const law = connector();
    const rules = [
      {
        ruleId: "r-type",
        priority: 1,
        description: "type zone priority",
        conditions: [
          { field: "incidentType" as const, operator: "in" as const, value: ["ROBBERY", "ASSAULT"] },
          { field: "zone" as const, operator: "eq" as const, value: "NORTH" },
          { field: "priority" as const, operator: "gte" as const, value: 1 },
        ],
        targetConnectorId: "cadc_law",
        requireSupervisorApproval: true,
        enabled: true,
      },
    ];
    const result = CadRoutingEngine.resolve(
      writeBack,
      [law],
      incident({ zone: "NORTH", incidentType: "ROBBERY", priority: 1 }),
      rules,
    );
    expect(result.ok).toBe(true);
  });

  it("blocks connectors that have never reported healthy", () => {
    const law = connector({ lastHealthCheck: undefined });
    const rules = [
      {
        ruleId: "r1",
        priority: 1,
        description: "all",
        conditions: [],
        targetConnectorId: "cadc_law",
        requireSupervisorApproval: true,
        enabled: true,
      },
    ];
    expect(CadRoutingEngine.resolve(writeBack, [law], incident(), rules)).toEqual({
      ok: false,
      reason: "connector_unhealthy",
    });
  });

  it("blocks fire to law department cross-routing", () => {
    const law = connector();
    const rules = [
      {
        ruleId: "r1",
        priority: 1,
        description: "all",
        conditions: [],
        targetConnectorId: "cadc_law",
        requireSupervisorApproval: true,
        enabled: true,
      },
    ];
    const fireIncident = incident({ department: "fire", connectorId: "cadc_fire" });
    expect(CadRoutingEngine.resolve(writeBack, [law], fireIncident, rules)).toEqual({
      ok: false,
      reason: "department_mismatch",
    });
  });
});
