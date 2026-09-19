import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { AdapterRegistry } from "./cad-adapters/index.js";
import { GenericRestCadAdapter } from "./cad-adapters/generic-rest.adapter.js";
import { AVLStore } from "./avl/store.js";
import { HeartbeatMonitor } from "./health/heartbeat.js";
import { AuditLogger } from "./hub-core/audit.js";
import { HubRouter } from "./hub-core/router.js";
import { AgencyRegistry } from "./hub-core/registry.js";
import { IncidentTracker } from "./hub-core/incident-tracker.js";
import { RedactionEngine } from "./redaction/engine.js";
import { ddb } from "../repositories/baseRepository.js";
import { env } from "../lib/env.js";
import {
  DynamoRulesPersistence,
  InMemoryRulesPersistence,
  TransferRulesEngine,
  type AgencyConfig,
  type TransferRule,
} from "./transfer-rules/engine.js";
import { getAgencySlots, isSlotAcceptingOutbound, type C2cAgencySlots } from "./slots.js";
import type { ICadAdapter } from "./cad-adapters/adapter.interface.js";

export interface C2cRuntime {
  tenantAgencyId: string;
  slots: C2cAgencySlots;
  router: HubRouter;
  registry: AgencyRegistry;
  rules: TransferRulesEngine;
  adapters: AdapterRegistry;
  audit: AuditLogger;
  tracker: IncidentTracker;
  health: HeartbeatMonitor;
  avl: AVLStore;
}

export function slotAgency(tenantAgencyId: string, slot: string): string {
  return `${tenantAgencyId}:${slot}`;
}

function hubFanoutRule(tenantAgencyId: string, targets: string[]): TransferRule {
  const now = new Date().toISOString();
  return {
    id: `${tenantAgencyId}-HUB-FANOUT`,
    name: "C2C hub fan-out to enabled slots",
    description: "Forward new incidents to every other outbound-enabled CAD slot on this tenant",
    enabled: targets.length > 0,
    priority: 100,
    sourceAgencies: "*",
    conditions: [],
    targetAgencies: targets,
    action: "FORWARD",
    requiresApproval: false,
    autoDispatch: false,
    createdAt: now,
    updatedAt: now,
    createdBy: "SYSTEM",
  };
}

export async function createC2cRuntime(tenantAgencyId: string): Promise<C2cRuntime> {
  const slots = await getAgencySlots(tenantAgencyId);
  const persist = env.c2cRulesTable
    ? new DynamoRulesPersistence(env.c2cRulesTable, tenantAgencyId)
    : new InMemoryRulesPersistence();
  const rules = new TransferRulesEngine(persist);
  await rules.loadRules();
  const registry = new AgencyRegistry(rules);
  const adapters = new AdapterRegistry();
  const adapterMap = new Map<string, ICadAdapter>();

  const agencyConfigs: AgencyConfig[] = [];
  for (const slot of slots.slots) {
    const id = slotAgency(tenantAgencyId, slot.slot);
    agencyConfigs.push({
      agencyId: id,
      agencyName: slot.label,
      agencyType: "COMBINED",
      jurisdictionCodes: [tenantAgencyId],
      dataShareAgreements: [],
    });
  }
  for (const cfg of agencyConfigs) {
    cfg.dataShareAgreements = agencyConfigs.filter((o) => o.agencyId !== cfg.agencyId).map((o) => o.agencyId);
    await registry.registerAgency(cfg);
  }

  const outboundIds = slots.slots.filter(isSlotAcceptingOutbound).map((s) => slotAgency(tenantAgencyId, s.slot));
  const fanoutId = `${tenantAgencyId}-HUB-FANOUT`;
  const existing = await persist.getRule(fanoutId);
  if (!existing) {
    await rules.addRule(hubFanoutRule(tenantAgencyId, outboundIds));
  } else {
    await rules.updateRule(fanoutId, {
      enabled: outboundIds.length > 0,
      targetAgencies: outboundIds,
    });
  }

  for (const slot of slots.slots) {
    const adapter = new GenericRestCadAdapter(tenantAgencyId, slot);
    await adapter.initialize();
    adapters.register(adapter);
    adapterMap.set(adapter.agencyId, adapter);
  }

  const audit = new AuditLogger(env.c2cAuditTable);
  const health = new HeartbeatMonitor();
  for (const adapter of adapters.getAll()) {
    await health.startMonitoring(adapter.agencyId, adapter);
  }
  const tracker = new IncidentTracker(env.c2cIncidentsTable);
  const router = new HubRouter(registry, rules, new RedactionEngine(), adapterMap, audit, health, tracker);
  return {
    tenantAgencyId,
    slots,
    router,
    registry,
    rules,
    adapters,
    audit,
    tracker,
    health,
    avl: new AVLStore(env.c2cAvlTable),
  };
}

const cache = new Map<string, Promise<C2cRuntime>>();

export function getC2cRuntime(agencyId: string): Promise<C2cRuntime> {
  const id = agencyId.trim();
  if (!id) return createC2cRuntime("unknown");
  const hit = cache.get(id);
  if (hit) return hit;
  const created = createC2cRuntime(id);
  cache.set(id, created);
  return created;
}

export function resetC2cRuntime(agencyId?: string): void {
  if (agencyId) cache.delete(agencyId);
  else cache.clear();
}

/** System poller directory: C2C agencies table holds one item per Rapid Cortex tenant. */
export async function listC2cTenantAgencyIds(): Promise<string[]> {
  const table = env.c2cAgenciesTable;
  if (!table) return [];
  const result = await ddb.send(new ScanCommand({ TableName: table, ProjectionExpression: "agencyId" }));
  return (result.Items ?? []).map((item) => String(item.agencyId ?? "")).filter(Boolean);
}
