/**
 * C2C Transfer Rules Engine
 * Determines which agencies receive an incident and under what conditions.
 * Rules are evaluated in priority order (lower number = first).
 */

import type { EidoEnvelope, IncidentPriority, APCOIncidentTypeCode } from '../eido/index.js';
import { isInBoundary } from './geo.js';

// ─── Types ────────────────────────────────────────────────────────────────

export interface AgencyConfig {
  agencyId: string;
  agencyName: string;
  agencyType: 'LAW_ENFORCEMENT' | 'FIRE' | 'EMS' | 'COMBINED';
  jurisdictionCodes: string[];
  boundingBox?: BoundingBox;
  boundaryGeoJSON?: GeoJSONPolygon;
  mutualAidZones?: string[];
  dataShareAgreements: string[];  // agencyIds this agency has DSA with
}

export interface BoundingBox {
  minLat: number; maxLat: number;
  minLon: number; maxLon: number;
}

export interface GeoJSONPolygon {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][];
}

export type RuleCondition =
  | { type: 'INCIDENT_TYPE'; codes: APCOIncidentTypeCode[] }
  | { type: 'INCIDENT_TYPE_CATEGORY'; categories: ('Law' | 'Fire' | 'EMS' | 'Traffic' | 'Hazmat' | 'Rescue' | 'Other')[] }
  | { type: 'GEOGRAPHIC'; boundaryAgencyId: string }       // incident must be in this agency's boundary
  | { type: 'GEOGRAPHIC_BOX'; box: BoundingBox }
  | { type: 'CALL_PRIORITY'; priorities: IncidentPriority[] }
  | { type: 'JURISDICTION'; jurisdictionCodes: string[] }
  | { type: 'MUTUAL_AID_ZONE'; zoneId: string }
  | { type: 'TIME_OF_DAY'; startHour: number; endHour: number; timezone: string }
  | { type: 'UNIT_COUNT'; maxUnitsAvailable: number }      // auto-aid when source is low on units
  | { type: 'AND'; conditions: RuleCondition[] }
  | { type: 'OR'; conditions: RuleCondition[] }
  | { type: 'NOT'; condition: RuleCondition };

export interface TransferRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  sourceAgencies: string[] | '*';
  conditions: RuleCondition[];
  targetAgencies: string[];
  action: 'FORWARD' | 'ALERT' | 'FORWARD_AND_ALERT';
  requiresApproval: boolean;
  autoDispatch: boolean;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface TransferDecision {
  targetAgencyId: string;
  triggeredByRuleId: string;
  triggeredByRuleName: string;
  action: TransferRule['action'];
  requiresApproval: boolean;
  autoDispatch: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
}

export interface RulesEvaluationResult {
  incidentId: string;
  sourceAgencyId: string;
  decisions: TransferDecision[];
  evaluatedAt: string;
  rulesChecked: number;
  executionMs: number;
}

// ─── Default rules for the Charleston County tri-county deployment ─────────

export const DEFAULT_CHARLESTON_RULES: Omit<TransferRule, 'createdAt' | 'updatedAt' | 'createdBy'>[] = [
  {
    id: 'CC-RULE-001',
    name: 'Auto-Forward MVA/Crash to adjacent county',
    description: 'Any motor vehicle accident or crash incident near a county border is automatically forwarded to the adjacent county ECC for awareness and potential mutual aid.',
    enabled: true,
    priority: 10,
    sourceAgencies: '*',
    conditions: [
      {
        type: 'INCIDENT_TYPE',
        codes: [
          'TC-MVC',    // Motor Vehicle Collision
          'TC-PI',     // Personal Injury Accident
          'TC-HNR',    // Hit and Run
          'TC-FAT',    // Fatal Accident
          'TC-CRASH',  // General crash
          'ME-MVC',    // MVC with Medical Emergency
        ],
      },
    ],
    targetAgencies: ['BERK-SC', 'DORCH-SC', 'CHAS-SC'],  // all counties — filter by sender
    action: 'FORWARD_AND_ALERT',
    requiresApproval: false,
    autoDispatch: false,
    expiresAt: undefined,
  },
  {
    id: 'CC-RULE-002',
    name: 'North Charleston / Dorchester County overlap',
    description: 'Incidents in the City of North Charleston that fall in Dorchester County should be forwarded to Dorchester 911.',
    enabled: true,
    priority: 20,
    sourceAgencies: ['CHAS-SC'],
    conditions: [
      {
        type: 'GEOGRAPHIC',
        boundaryAgencyId: 'DORCH-SC',
      },
    ],
    targetAgencies: ['DORCH-SC'],
    action: 'FORWARD',
    requiresApproval: true,
    autoDispatch: false,
  },
  {
    id: 'CC-RULE-003',
    name: 'City of Charleston / Berkeley County overlap',
    description: 'City of Charleston units serving areas of Berkeley County trigger an alert to Berkeley 911.',
    enabled: true,
    priority: 30,
    sourceAgencies: ['CHAS-SC'],
    conditions: [
      { type: 'GEOGRAPHIC', boundaryAgencyId: 'BERK-SC' },
    ],
    targetAgencies: ['BERK-SC'],
    action: 'FORWARD',
    requiresApproval: true,
    autoDispatch: false,
  },
  {
    id: 'CC-RULE-004',
    name: 'High-priority mutual aid alert',
    description: 'Any Priority 1 or Priority 2 incident is alertd to adjacent agencies for situational awareness.',
    enabled: true,
    priority: 5,
    sourceAgencies: '*',
    conditions: [
      { type: 'CALL_PRIORITY', priorities: ['1', '2'] },
    ],
    targetAgencies: ['BERK-SC', 'DORCH-SC', 'CHAS-SC'],
    action: 'ALERT',
    requiresApproval: false,
    autoDispatch: false,
  },
  {
    id: 'CC-RULE-005',
    name: 'Hazmat incident — all county alert',
    description: 'Any hazardous materials incident is immediately forwarded to all three counties.',
    enabled: true,
    priority: 1,
    sourceAgencies: '*',
    conditions: [
      {
        type: 'INCIDENT_TYPE_CATEGORY',
        categories: ['Hazmat'],
      },
    ],
    targetAgencies: ['BERK-SC', 'DORCH-SC', 'CHAS-SC'],
    action: 'FORWARD_AND_ALERT',
    requiresApproval: false,
    autoDispatch: false,
  },
];

// ─── Geographic condition evaluation ─────────────────────────────────────

/**
 * Point-in-polygon test using ray casting algorithm.
 * For production, use @turf/boolean-point-in-polygon.
 */
function pointInPolygon(lat: number, lon: number, polygon: GeoJSONPolygon): boolean {
  return isInBoundary([lon, lat], polygon);
}

function isInBoundingBox(lat: number, lon: number, box: BoundingBox): boolean {
  return lat >= box.minLat && lat <= box.maxLat
    && lon >= box.minLon && lon <= box.maxLon;
}

// ─── Rules Engine ─────────────────────────────────────────────────────────

export class TransferRulesEngine {
  private rules: Map<string, TransferRule> = new Map();
  private agencyBoundaries: Map<string, GeoJSONPolygon> = new Map();

  constructor(private readonly persistRules: RulesPersistence) {}

  async loadRules(): Promise<void> {
    const stored = await this.persistRules.listRules();
    this.rules.clear();
    for (const rule of stored) {
      this.rules.set(rule.id, rule);
    }
  }

  async loadAgencyBoundaries(boundaries: Map<string, GeoJSONPolygon>): Promise<void> {
    this.agencyBoundaries = boundaries;
  }

  /**
   * Evaluate all rules against an incoming incident.
   * Returns transfer decisions sorted by rule priority.
   */
  async evaluate(
    incident: EidoEnvelope,
    senderAgencyId: string,
    allAgencies: AgencyConfig[],
  ): Promise<RulesEvaluationResult> {
    const startMs = Date.now();
    const decisions: TransferDecision[] = [];
    const decidedTargets = new Set<string>();

    // Sort rules by priority (lower = higher priority = first)
    const sortedRules = Array.from(this.rules.values())
      .filter(r => r.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      // Check if this rule applies to the sending agency
      if (rule.sourceAgencies !== '*' && !rule.sourceAgencies.includes(senderAgencyId)) {
        continue;
      }

      // Evaluate all conditions (AND semantics)
      const conditionsMet = this.evaluateConditions(
        rule.conditions,
        incident,
        senderAgencyId,
        allAgencies,
      );

      if (!conditionsMet) continue;

      // Rule matched — create a decision for each target
      for (const targetAgencyId of rule.targetAgencies) {
        // Skip the sender — don't route an incident back to where it came from
        if (targetAgencyId === senderAgencyId) continue;
        // Skip if we already have a higher-priority decision for this target
        if (decidedTargets.has(targetAgencyId)) continue;
        // Verify data sharing agreement exists
        const targetAgency = allAgencies.find(a => a.agencyId === targetAgencyId);
        if (!targetAgency) continue;
        if (!targetAgency.dataShareAgreements.includes(senderAgencyId)) continue;

        decisions.push({
          targetAgencyId,
          triggeredByRuleId: rule.id,
          triggeredByRuleName: rule.name,
          action: rule.action,
          requiresApproval: rule.requiresApproval,
          autoDispatch: rule.autoDispatch,
          confidence: 'HIGH',
          reasoning: `Rule "${rule.name}" matched: ${this.describeMatch(rule, incident)}`,
        });
        decidedTargets.add(targetAgencyId);
      }
    }

    return {
      incidentId: incident.incident.IncidentId,
      sourceAgencyId: senderAgencyId,
      decisions,
      evaluatedAt: new Date().toISOString(),
      rulesChecked: sortedRules.length,
      executionMs: Date.now() - startMs,
    };
  }

  private evaluateConditions(
    conditions: RuleCondition[],
    incident: EidoEnvelope,
    senderAgencyId: string,
    allAgencies: AgencyConfig[],
  ): boolean {
    return conditions.every(condition =>
      this.evaluateCondition(condition, incident, senderAgencyId, allAgencies)
    );
  }

  private evaluateCondition(
    condition: RuleCondition,
    incident: EidoEnvelope,
    senderAgencyId: string,
    allAgencies: AgencyConfig[],
  ): boolean {
    const inc = incident.incident;

    switch (condition.type) {
      case 'INCIDENT_TYPE':
        return condition.codes.some(code =>
          inc.CallType === code ||
          inc.CallType.startsWith(code + '-')
        );

      case 'INCIDENT_TYPE_CATEGORY': {
        // Map category to APCO code prefixes
        const categoryPrefixes: Record<string, string[]> = {
          'Law': ['LA', 'CR', 'VP', 'AS'],
          'Fire': ['FI', 'SV'],
          'EMS': ['ME', 'EM'],
          'Traffic': ['TC', 'MV'],
          'Hazmat': ['HM', 'HZ'],
          'Rescue': ['RE', 'WR'],
          'Other': ['OU', 'OT'],
        };
        return condition.categories.some(cat =>
          categoryPrefixes[cat]?.some(prefix => inc.CallType.startsWith(prefix))
        );
      }

      case 'CALL_PRIORITY':
        return condition.priorities.includes(inc.Priority);

      case 'JURISDICTION': {
        const jurisdiction = inc.Location.Jurisdiction ?? inc.Location.County ?? '';
        return condition.jurisdictionCodes.some(code =>
          jurisdiction.toUpperCase().includes(code.toUpperCase())
        );
      }

      case 'GEOGRAPHIC': {
        const coords = inc.Location.Coordinates;
        if (!coords) return false;
        const boundary = this.agencyBoundaries.get(condition.boundaryAgencyId);
        if (!boundary) return false;
        return pointInPolygon(coords.Latitude, coords.Longitude, boundary);
      }

      case 'GEOGRAPHIC_BOX': {
        const coords = inc.Location.Coordinates;
        if (!coords) return false;
        return isInBoundingBox(coords.Latitude, coords.Longitude, condition.box);
      }

      case 'TIME_OF_DAY': {
        const now = new Date();
        // TODO: respect timezone
        const hour = now.getUTCHours();
        if (condition.startHour <= condition.endHour) {
          return hour >= condition.startHour && hour < condition.endHour;
        } else {
          // Spans midnight
          return hour >= condition.startHour || hour < condition.endHour;
        }
      }

      case 'MUTUAL_AID_ZONE': {
        const senderAgency = allAgencies.find(a => a.agencyId === senderAgencyId);
        return senderAgency?.mutualAidZones?.includes(condition.zoneId) ?? false;
      }

      case 'UNIT_COUNT': {
        const senderAgency = allAgencies.find(a => a.agencyId === senderAgencyId);
        const available = Number(senderAgency ? (senderAgency as AgencyConfig & { availableUnitCount?: number }).availableUnitCount ?? 0 : 0);
        return available <= condition.maxUnitsAvailable;
      }

      case 'AND':
        return condition.conditions.every(c =>
          this.evaluateCondition(c, incident, senderAgencyId, allAgencies)
        );

      case 'OR':
        return condition.conditions.some(c =>
          this.evaluateCondition(c, incident, senderAgencyId, allAgencies)
        );

      case 'NOT':
        return !this.evaluateCondition(condition.condition, incident, senderAgencyId, allAgencies);

      default:
        return false;
    }
  }

  private describeMatch(rule: TransferRule, incident: EidoEnvelope): string {
    return `CallType=${incident.incident.CallType}, Priority=${incident.incident.Priority}, Location=${incident.incident.Location.Address.City}`;
  }

  // ── Rule Management ───────────────────────────────────────────────────

  async addRule(rule: TransferRule): Promise<void> {
    await this.persistRules.saveRule(rule);
    this.rules.set(rule.id, rule);
  }

  async updateRule(ruleId: string, update: Partial<TransferRule>): Promise<void> {
    const existing = this.rules.get(ruleId);
    if (!existing) throw new Error(`Rule not found: ${ruleId}`);
    const updated = { ...existing, ...update, id: ruleId, updatedAt: new Date().toISOString() };
    await this.persistRules.saveRule(updated);
    this.rules.set(ruleId, updated);
  }

  async deleteRule(ruleId: string): Promise<void> {
    await this.persistRules.deleteRule(ruleId);
    this.rules.delete(ruleId);
  }

  async listRules(filter?: { enabled?: boolean; sourceAgencyId?: string }): Promise<TransferRule[]> {
    let rules = Array.from(this.rules.values());
    if (filter?.enabled !== undefined) rules = rules.filter(r => r.enabled === filter.enabled);
    if (filter?.sourceAgencyId) {
      rules = rules.filter(r =>
        r.sourceAgencies === '*' ||
        (Array.isArray(r.sourceAgencies) && r.sourceAgencies.includes(filter.sourceAgencyId!))
      );
    }
    return rules.sort((a, b) => a.priority - b.priority);
  }

  async importDefaultRules(_agencyId: string): Promise<void> {
    const now = new Date().toISOString();
    for (const rule of DEFAULT_CHARLESTON_RULES) {
      await this.addRule({ ...rule, createdAt: now, updatedAt: now, createdBy: 'SYSTEM' });
    }
  }
}

// ─── Persistence interface ─────────────────────────────────────────────────

export interface RulesPersistence {
  saveRule(rule: TransferRule): Promise<void>;
  deleteRule(ruleId: string): Promise<void>;
  listRules(filter?: { enabled?: boolean }): Promise<TransferRule[]>;
  getRule(ruleId: string): Promise<TransferRule | null>;
}

export class InMemoryRulesPersistence implements RulesPersistence {
  private rules = new Map<string, TransferRule>();

  async saveRule(rule: TransferRule): Promise<void> {
    this.rules.set(rule.id, structuredClone(rule));
  }

  async deleteRule(ruleId: string): Promise<void> {
    this.rules.delete(ruleId);
  }

  async listRules(filter?: { enabled?: boolean }): Promise<TransferRule[]> {
    let rules = [...this.rules.values()];
    if (filter?.enabled !== undefined) rules = rules.filter((r) => r.enabled === filter.enabled);
    return rules;
  }

  async getRule(ruleId: string): Promise<TransferRule | null> {
    return this.rules.get(ruleId) ?? null;
  }
}

/** DynamoDB implementation of RulesPersistence — keyed by agencyId then ruleId. */
export class DynamoRulesPersistence implements RulesPersistence {
  constructor(
    private readonly tableName: string,
    private readonly agencyId: string,
  ) {}

  private pk(): string {
    return `AGENCY#${this.agencyId}`;
  }

  async saveRule(rule: TransferRule): Promise<void> {
    const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
    const { DynamoDBDocumentClient, PutCommand } = await import("@aws-sdk/lib-dynamodb");
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    await client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { pk: this.pk(), sk: `RULE#${rule.id}`, agencyId: this.agencyId, ...rule },
      }),
    );
  }

  async deleteRule(ruleId: string): Promise<void> {
    const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
    const { DynamoDBDocumentClient, DeleteCommand } = await import("@aws-sdk/lib-dynamodb");
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    await client.send(
      new DeleteCommand({ TableName: this.tableName, Key: { pk: this.pk(), sk: `RULE#${ruleId}` } }),
    );
  }

  async listRules(filter?: { enabled?: boolean }): Promise<TransferRule[]> {
    const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
    const { DynamoDBDocumentClient, QueryCommand } = await import("@aws-sdk/lib-dynamodb");
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    const result = await client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: { ":pk": this.pk(), ":sk": "RULE#" },
      }),
    );
    let rules = (result.Items ?? []) as TransferRule[];
    if (filter?.enabled !== undefined) rules = rules.filter((r) => r.enabled === filter.enabled);
    return rules;
  }

  async getRule(ruleId: string): Promise<TransferRule | null> {
    const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
    const { DynamoDBDocumentClient, GetCommand } = await import("@aws-sdk/lib-dynamodb");
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    const result = await client.send(
      new GetCommand({ TableName: this.tableName, Key: { pk: this.pk(), sk: `RULE#${ruleId}` } }),
    );
    return (result.Item as TransferRule | undefined) ?? null;
  }
}
