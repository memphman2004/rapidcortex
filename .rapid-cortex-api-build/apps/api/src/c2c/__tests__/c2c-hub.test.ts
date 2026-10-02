import { afterEach, describe, expect, it, vi } from "vitest";
import { validateEido } from "../eido/validator.js";
import { EidoBuilder } from "../eido/builder.js";
import { diffEido } from "../eido/diff.js";
import type { EidoEnvelope } from "../eido/types.js";
import { RedactionEngine } from "../redaction/engine.js";
import {
  DEFAULT_CHARLESTON_RULES,
  InMemoryRulesPersistence,
  TransferRulesEngine,
  type AgencyConfig,
} from "../transfer-rules/engine.js";
import { MockCadAdapter } from "../cad-adapters/mock.adapter.js";
import { SouthernSoftwareAdapter } from "../cad-adapters/southern-software.adapter.js";
import { GenericRestCadAdapter } from "../cad-adapters/generic-rest.adapter.js";
import { AdapterDisabledError } from "../cad-adapters/http-client.js";
import { isCadWritebackEnabled } from "../cad-adapters/writeback-gate.js";
import { CAD_BRIDGE_SLOTS } from "rapid-cortex-shared";
import { buildDefaultSlots } from "../slots.js";
import { HubRouter } from "../hub-core/router.js";
import { AgencyRegistry } from "../hub-core/registry.js";
import { AuditLogger } from "../hub-core/audit.js";
import { IncidentTracker } from "../hub-core/incident-tracker.js";
import { HeartbeatMonitor } from "../health/heartbeat.js";
import { APCO_INCIDENT_TYPES, isValidIncidentTypeCode } from "../common-codes/incident-types.js";
import { mapSSIncidentType } from "../common-codes/mappers/southern-software.js";
import { mapCSIncidentType } from "../common-codes/mappers/centralsquare.js";

function sampleEido(overrides?: Partial<EidoEnvelope["incident"]> & { sender?: string }): EidoEnvelope {
  const now = new Date().toISOString();
  const { sender, ...incidentOverrides } = overrides ?? {};
  return {
    header: {
      MessageId: crypto.randomUUID(),
      DateTimeSent: now,
      SenderAgencyId: sender ?? "BERK-SC",
      SenderAgencyName: "Berkeley County ECC",
      RecipientAgencyId: "*",
      SchemaVersion: "APCO-NENA-2.105.1-2017",
      MessageType: "NEW_INCIDENT",
    },
    incident: {
      IncidentId: "2026-BERK-001234",
      CallType: "TC-MVC",
      CallTypeDescription: "Motor vehicle collision",
      Priority: "3",
      Status: "ACTIVE",
      Location: {
        Address: {
          FullAddress: "I-26 and US-78",
          StreetName: "I-26",
          City: "North Charleston",
          State: "SC",
          County: "Berkeley",
        },
        Coordinates: { Latitude: 33.01, Longitude: -80.05, DeterminationMethod: "GPS" },
      },
      ReceivedAt: now,
      UpdatedAt: now,
      Subjects: [
        {
          SubjectId: "S1",
          Role: "SUSPECT",
          CriminalHistory: true,
          WarrantsIndicator: true,
          Weapons: "handgun",
        },
      ],
      LESpecificNotes: "warrant confirmed",
      ...incidentOverrides,
    },
  };
}

const agencies: AgencyConfig[] = [
  {
    agencyId: "BERK-SC",
    agencyName: "Berkeley",
    agencyType: "COMBINED",
    jurisdictionCodes: ["BERKELEY"],
    dataShareAgreements: ["DORCH-SC", "CHAS-SC"],
  },
  {
    agencyId: "DORCH-SC",
    agencyName: "Dorchester",
    agencyType: "COMBINED",
    jurisdictionCodes: ["DORCHESTER"],
    dataShareAgreements: ["BERK-SC", "CHAS-SC"],
  },
  {
    agencyId: "CHAS-SC",
    agencyName: "Charleston",
    agencyType: "LAW_ENFORCEMENT",
    jurisdictionCodes: ["CHARLESTON"],
    dataShareAgreements: ["BERK-SC", "DORCH-SC"],
  },
];

describe("C2C common codes", () => {
  it("includes APCO-style incident types used by Charleston default rules", () => {
    expect(APCO_INCIDENT_TYPES["TC-MVC"].category).toBe("Traffic");
    expect(isValidIncidentTypeCode("TC-MVC")).toBe(true);
    expect(isValidIncidentTypeCode("X-LOCAL")).toBe(true);
    expect(isValidIncidentTypeCode("")).toBe(false);
  });

  it("maps vendor stubs to APCO or null", () => {
    expect(mapSSIncidentType("MVA")).toBe("TC-MVC");
    expect(mapSSIncidentType("not-a-real-type")).toBeNull();
    expect(mapCSIncidentType("MVC")).toBe("TC-MVC");
  });
});

describe("EIDO validator", () => {
  it("accepts a well-formed envelope", () => {
    const result = validateEido(sampleEido());
    expect(result.ok).toBe(true);
  });

  it("rejects missing UUID v4 MessageId", () => {
    const eido = sampleEido();
    eido.header.MessageId = "not-a-uuid";
    const result = validateEido(eido);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.some((e) => e.field === "header.MessageId")).toBe(true);
  });

  it("rejects missing coordinates on NEW_INCIDENT", () => {
    const eido = sampleEido();
    delete eido.incident.Location.Coordinates;
    const result = validateEido(eido);
    expect(result.ok).toBe(false);
  });

  it("rejects unknown CallType without X- prefix", () => {
    const eido = sampleEido({ CallType: "NOPE" });
    const result = validateEido(eido);
    expect(result.ok).toBe(false);
  });

  it("rejects invalid unit ids", () => {
    const eido = sampleEido({
      Units: [{ UnitId: "too long / invalid unit id!!!", UnitType: "MEDIC", AgencyId: "BERK-SC", Status: "AVAILABLE" }],
    });
    const result = validateEido(eido);
    expect(result.ok).toBe(false);
  });

  it("builder + diff produce incremental updates", () => {
    const built = EidoBuilder.fromCADIncident(
      {
        nativeId: "N1",
        sourceAgencyId: "BERK-SC",
        adapterType: "MOCK",
        rawData: { callType: "TC-MVC", city: "Moncks Corner", state: "SC", address: "Main", latitude: 33.2, longitude: -80.0 },
        fetchedAt: new Date().toISOString(),
      },
      "BERK-SC",
    )
      .withCallerInfo({ Name: "RP", CallbackNumber: "+18435551234" })
      .build();
    const next = structuredClone(built);
    next.incident.Status = "DISPATCHED";
    const diff = diffEido(built, next);
    expect(diff.changes.some((c) => c.field === "incident.Status")).toBe(true);
  });
});

describe("redaction", () => {
  it("keeps CJI for law and strips it for fire/EMS", () => {
    const engine = new RedactionEngine();
    const source = sampleEido();
    const law = engine.redact(source, "LAW_ENFORCEMENT");
    const fire = engine.redact(source, "FIRE");
    const ems = engine.redact(source, "EMS");
    expect(law.incident.LESpecificNotes).toBe("warrant confirmed");
    expect(fire.incident.LESpecificNotes).toBeUndefined();
    expect(ems.incident.LESpecificNotes).toBeUndefined();
    expect(fire.header.RedactionManifest?.length).toBeGreaterThan(0);
    expect(source.incident.LESpecificNotes).toBe("warrant confirmed");
  });
});

describe("transfer rules", () => {
  it("forwards MVA from Berkeley to the other counties", async () => {
    const persist = new InMemoryRulesPersistence();
    const engine = new TransferRulesEngine(persist);
    const now = new Date().toISOString();
    for (const rule of DEFAULT_CHARLESTON_RULES) {
      await engine.addRule({ ...rule, createdAt: now, updatedAt: now, createdBy: "test" });
    }
    const result = await engine.evaluate(sampleEido({ CallType: "TC-MVC", Priority: "3" }), "BERK-SC", agencies);
    const targets = result.decisions.map((d) => d.targetAgencyId).sort();
    expect(targets).toEqual(["CHAS-SC", "DORCH-SC"]);
  });

  it("alerts adjacent agencies on priority 1", async () => {
    const persist = new InMemoryRulesPersistence();
    const engine = new TransferRulesEngine(persist);
    const now = new Date().toISOString();
    for (const rule of DEFAULT_CHARLESTON_RULES) {
      await engine.addRule({ ...rule, createdAt: now, updatedAt: now, createdBy: "test" });
    }
    const result = await engine.evaluate(sampleEido({ Priority: "1", CallType: "LA-ASLT" }), "BERK-SC", agencies);
    expect(result.decisions.some((d) => d.action === "ALERT")).toBe(true);
  });
});

describe("mock adapter + hub router", () => {
  it("fans an MVA from BERK mock CAD into CHAS createIncident", async () => {
    const berk = new MockCadAdapter({
      agencyId: "BERK-SC",
      agencyName: "Berkeley",
      boundingBox: { minLat: 33, maxLat: 33.2, minLon: -80.1, maxLon: -79.9 },
      incidentRatePerHour: 0,
      unitCount: 2,
      incidentTypeDist: { "TC-MVC": 1 },
    });
    const chas = new MockCadAdapter({
      agencyId: "CHAS-SC",
      agencyName: "Charleston",
      boundingBox: { minLat: 32.7, maxLat: 32.9, minLon: -80.1, maxLon: -79.8 },
      incidentRatePerHour: 0,
      unitCount: 2,
      incidentTypeDist: { "TC-MVC": 1 },
    });
    await berk.initialize();
    await chas.initialize();
    const persist = new InMemoryRulesPersistence();
    const rules = new TransferRulesEngine(persist);
    const now = new Date().toISOString();
    for (const rule of DEFAULT_CHARLESTON_RULES) {
      await rules.addRule({ ...rule, createdAt: now, updatedAt: now, createdBy: "test" });
    }
    const registry = new AgencyRegistry(rules);
    for (const agency of agencies) await registry.registerAgency(agency);
    const audit = new AuditLogger();
    const router = new HubRouter(
      registry,
      rules,
      new RedactionEngine(),
      new Map([
        ["BERK-SC", berk],
        ["CHAS-SC", chas],
      ]),
      audit,
      new HeartbeatMonitor(),
      new IncidentTracker(),
    );
    const created = await berk.createIncident({ eido: sampleEido(), autoDispatch: false });
    const routed = await router.routeNewIncident(created.confirmedEido ?? sampleEido());
    expect(routed.targets.some((t) => t.agencyId === "CHAS-SC" && t.ok)).toBe(true);
    const chasIncidents = await chas.getActiveIncidents();
    expect(chasIncidents.incidents.length).toBeGreaterThan(0);
    const log = await audit.list({ agencyId: "CHAS-SC" });
    expect(log.some((e) => e.status === "SUCCESS")).toBe(true);
  });
});

describe("eight CAD slots", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it("defaults CAD_A–H inbound on and outbound off", () => {
    const slots = buildDefaultSlots("tenant-1");
    expect(slots.map((s) => s.slot)).toEqual([...CAD_BRIDGE_SLOTS]);
    expect(slots).toHaveLength(8);
    expect(slots.every((s) => s.enabled && s.inboundEnabled && !s.outboundEnabled)).toBe(true);
    expect(slots[0]?.credentialsSecretArn).toBe("rapid-cortex/c2c/tenant-1/cad-a");
    expect(slots[7]?.credentialsSecretArn).toBe("rapid-cortex/c2c/tenant-1/cad-h");
  });

  it("does not poll a slot until the vendor secret has a base URL", async () => {
    const slot = buildDefaultSlots("tenant-1")[0]!;
    const adapter = new GenericRestCadAdapter("tenant-1", slot);
    await adapter.initialize();
    const health = await adapter.healthCheck();
    expect(health.status).toBe("UNKNOWN");
    expect(health.errorMessage).toMatch(/Waiting for secret/);
    const pulled = await adapter.getActiveIncidents();
    expect(pulled.incidents).toEqual([]);
  });

  it("skips outbound HTTP when the slot outbound toggle is off", async () => {
    const slot = buildDefaultSlots("tenant-1")[0]!;
    const adapter = new GenericRestCadAdapter("tenant-1", slot, {
      baseUrl: "https://cad.example.invalid/",
      apiKey: "test-key",
    });
    await adapter.initialize();
    await expect(adapter.createIncident({ eido: sampleEido(), autoDispatch: false })).rejects.toThrow(
      AdapterDisabledError,
    );
  });

  it("keeps GenericRest writes fail-closed even when outbound is on", async () => {
    vi.stubEnv("CAD_WRITEBACK_ENABLED", "");
    const slot = { ...buildDefaultSlots("tenant-1")[0]!, outboundEnabled: true };
    const adapter = new GenericRestCadAdapter("tenant-1", slot, {
      baseUrl: "https://cad.example.invalid/",
      apiKey: "test-key",
    });
    await adapter.initialize();
    await expect(adapter.createIncident({ eido: sampleEido(), autoDispatch: false })).rejects.toThrow(/fail-closed/);
  });
});

describe("CAD write-back fail-closed", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("blocks Southern Software createIncident unless CAD_WRITEBACK_ENABLED", async () => {
    vi.stubEnv("CAD_WRITEBACK_ENABLED", "");
    expect(isCadWritebackEnabled()).toBe(false);
    const adapter = new SouthernSoftwareAdapter({
      agencyId: "BERK-SC",
      agencyName: "Berkeley",
      baseUrl: "https://example.invalid/ssapi",
      apiKey: "test",
      agencyCode: "BERK-SC",
      version: "21",
      pollIntervalMs: 5000,
    });
    await adapter.initialize();
    await expect(adapter.createIncident({ eido: sampleEido(), autoDispatch: false })).rejects.toThrow(/fail-closed/);
  });
});
