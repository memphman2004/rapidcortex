import type {
  CadConnectorConfig,
  CadDepartmentType,
  CadRoutingCondition,
  CadRoutingRule,
  CadWriteBackRequest,
  UnifiedCadIncident,
} from "rapid-cortex-shared";

export type CadRoutingResult =
  | { ok: true; connectorId: string; rule: CadRoutingRule }
  | {
      ok: false;
      reason: "no_route" | "connector_disabled" | "connector_unhealthy" | "department_mismatch";
    };

export class CadNoRouteError extends Error {
  constructor(
    message: string,
    public readonly reason:
      | "no_route"
      | "connector_disabled"
      | "connector_unhealthy"
      | "department_mismatch",
  ) {
    super(message);
    this.name = "CadNoRouteError";
  }
}

const LAW: ReadonlySet<CadDepartmentType> = new Set(["law_enforcement"]);
const FIRE_EMS: ReadonlySet<CadDepartmentType> = new Set(["fire", "ems", "combined_fire_ems"]);

function departmentFamily(dept: CadDepartmentType): "law" | "fire_ems" | "other" {
  if (LAW.has(dept)) return "law";
  if (FIRE_EMS.has(dept)) return "fire_ems";
  return "other";
}

function inList(value: string, expected: string | string[]): boolean {
  const hay = Array.isArray(expected) ? expected : [expected];
  return hay.some((item) => item.toLowerCase() === value.toLowerCase());
}

function conditionMatches(condition: CadRoutingCondition, incident: UnifiedCadIncident): boolean {
  switch (condition.field) {
    case "department":
      return incident.department === condition.value;
    case "incidentType":
      return condition.operator === "eq"
        ? incident.incidentType.toLowerCase() === String(condition.value).toLowerCase()
        : inList(incident.incidentType, condition.value);
    case "zone":
      if (!incident.zone) return false;
      return condition.operator === "eq"
        ? incident.zone.toLowerCase() === String(condition.value).toLowerCase()
        : inList(incident.zone, condition.value);
    case "priority":
      if (condition.operator === "eq") return incident.priority === condition.value;
      if (condition.operator === "gte") return incident.priority >= condition.value;
      return incident.priority <= condition.value;
    case "callerLocation":
      // Zone-id geo fence is agency GIS — v1 matches incident.zone === zoneId.
      return (incident.zone ?? "").toLowerCase() === condition.zoneId.toLowerCase();
    default:
      return false;
  }
}

function ruleMatches(rule: CadRoutingRule, incident: UnifiedCadIncident): boolean {
  if (!rule.enabled) return false;
  if (rule.conditions.length === 0) return true;
  return rule.conditions.every((condition) => conditionMatches(condition, incident));
}

function uniqueRules(connectors: CadConnectorConfig[], extra?: CadRoutingRule[]): CadRoutingRule[] {
  const seen = new Set<string>();
  const out: CadRoutingRule[] = [];
  for (const rule of [...(extra ?? []), ...connectors.flatMap((c) => c.routingRules)]) {
    if (seen.has(rule.ruleId)) continue;
    seen.add(rule.ruleId);
    out.push(rule);
  }
  return out.sort((a, b) => a.priority - b.priority);
}

export class CadRoutingEngine {
  static resolve(
    _writeBack: CadWriteBackRequest,
    connectors: CadConnectorConfig[],
    incident: UnifiedCadIncident,
    rules?: CadRoutingRule[],
  ): CadRoutingResult {
    const byId = new Map(connectors.filter((c) => !c.deletedAt).map((c) => [c.connectorId, c]));
    const ordered = uniqueRules(connectors, rules);

    for (const rule of ordered) {
      if (!ruleMatches(rule, incident)) continue;
      const target = byId.get(rule.targetConnectorId);
      if (!target) {
        return { ok: false, reason: "no_route" };
      }
      if (!target.enabled) {
        return { ok: false, reason: "connector_disabled" };
      }
      if (target.lastHealthCheck?.status !== "healthy") {
        return { ok: false, reason: "connector_unhealthy" };
      }
      const incidentFamily = departmentFamily(incident.department);
      const targetFamily = departmentFamily(target.department);
      if (
        incidentFamily !== "other" &&
        targetFamily !== "other" &&
        incidentFamily !== targetFamily &&
        target.department !== "combined_all" &&
        incident.department !== "combined_all"
      ) {
        return { ok: false, reason: "department_mismatch" };
      }
      return { ok: true, connectorId: target.connectorId, rule };
    }
    return { ok: false, reason: "no_route" };
  }
}
