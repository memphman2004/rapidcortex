import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  RcsCall,
  RcsCallEnriched,
  RcsEscalationLevel,
  RcsEscalationRules,
  RcsUnit,
} from "rapid-cortex-shared";
import { RCS_CLOSED_STATES, RCS_ESCALATION_RULES_DEFAULTS } from "rapid-cortex-shared";
import { ddb } from "../../repositories/baseRepository.js";
import { env } from "../../lib/env.js";

export type RcsCallDdbItem = RcsCallEnriched & { entityType: "rcs_call" };

export type RcsUnitDdbItem = {
  entityType: "rcs_unit";
  pk: string;
  sk: string;
  agencyId: string;
  unitId: string;
  callSign?: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
  assignedCallId?: string;
};

export type RcsEscalationScheduleItem = {
  entityType: "rcs_escalation_schedule";
  pk: string;
  sk: string;
  callId: string;
  agencyId: string;
  level: RcsEscalationLevel;
  scheduleName: string;
  firesAt: string;
  createdAt: string;
};

type RcsEscalationRulesItem = RcsEscalationRules & {
  entityType: "rcs_escalation_rules";
  pk: string;
  sk: string;
};

function unitKey(agencyId: string, unitId: string) {
  return { pk: `AGENCY#${agencyId}`, sk: `UNIT#${unitId}` };
}

function escalationKey(callId: string, scheduleName: string) {
  return { pk: `CALL#${callId}`, sk: `SCHED#${scheduleName}` };
}

function rulesKey(agencyId: string) {
  return { pk: `AGENCY#${agencyId}`, sk: "RCS_ESCALATION_RULES" };
}

const CLOSED = new Set<string>(RCS_CLOSED_STATES);

export class RcsRepository {
  private callsTable(): string {
    const t = env.rcsCallsTable;
    if (!t) throw new Error("RCS_CALLS_TABLE_NOT_CONFIGURED");
    return t;
  }

  private unitsTable(): string {
    const t = env.rcsUnitsTable;
    if (!t) throw new Error("RCS_UNITS_TABLE_NOT_CONFIGURED");
    return t;
  }

  private escalationTable(): string {
    const t = env.rcsEscalationTable;
    if (!t) throw new Error("RCS_ESCALATION_TABLE_NOT_CONFIGURED");
    return t;
  }

  async createCall(call: RcsCall | RcsCallEnriched): Promise<void> {
    const item: RcsCallDdbItem = {
      ...call,
      stateEnteredAt: (call as RcsCallEnriched).stateEnteredAt ?? call.createdAt,
      entityType: "rcs_call",
    };
    await ddb.send(
      new PutCommand({
        TableName: this.callsTable(),
        Item: item,
        ConditionExpression: "attribute_not_exists(callId)",
      }),
    );
  }

  async getCall(agencyId: string, callId: string): Promise<RcsCallEnriched | null> {
    const r = await ddb.send(
      new GetCommand({ TableName: this.callsTable(), Key: { callId } }),
    );
    const item = r.Item as RcsCallDdbItem | undefined;
    if (!item || item.agencyId !== agencyId) return null;
    return this.toCall(item);
  }

  async getCallById(callId: string): Promise<RcsCallEnriched | null> {
    const r = await ddb.send(
      new GetCommand({ TableName: this.callsTable(), Key: { callId } }),
    );
    const item = r.Item as RcsCallDdbItem | undefined;
    if (!item) return null;
    return this.toCall(item);
  }

  async putCall(call: RcsCall | RcsCallEnriched): Promise<void> {
    const item: RcsCallDdbItem = { ...call, entityType: "rcs_call" };
    await ddb.send(new PutCommand({ TableName: this.callsTable(), Item: item }));
  }

  /**
   * Conditional update for intelligence fields / escalation.
   * When `expectedUpdatedAt` is set, ConditionExpression prevents races.
   */
  async updateCallAttributes(
    agencyId: string,
    callId: string,
    attrs: Record<string, unknown>,
    opts?: { expectedUpdatedAt?: string },
  ): Promise<RcsCallEnriched | null> {
    const names: Record<string, string> = { "#agencyId": "agencyId" };
    const values: Record<string, unknown> = { ":agencyId": agencyId };
    const sets: string[] = [];
    let i = 0;
    for (const [key, value] of Object.entries(attrs)) {
      const nk = `#k${i}`;
      const vk = `:v${i}`;
      names[nk] = key;
      values[vk] = value;
      sets.push(`${nk} = ${vk}`);
      i += 1;
    }
    if (sets.length === 0) return this.getCall(agencyId, callId);

    let condition = "#agencyId = :agencyId";
    if (opts?.expectedUpdatedAt) {
      names["#updatedAt"] = "updatedAt";
      values[":prevUpdatedAt"] = opts.expectedUpdatedAt;
      condition += " AND #updatedAt = :prevUpdatedAt";
    }

    try {
      const r = await ddb.send(
        new UpdateCommand({
          TableName: this.callsTable(),
          Key: { callId },
          UpdateExpression: `SET ${sets.join(", ")}`,
          ConditionExpression: condition,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ReturnValues: "ALL_NEW",
        }),
      );
      return this.toCall(r.Attributes as RcsCallDdbItem);
    } catch (err) {
      const name =
        err && typeof err === "object" && "name" in err
          ? String((err as { name: string }).name)
          : "";
      if (name === "ConditionalCheckFailedException") return null;
      throw err;
    }
  }

  async listCallsByAgency(
    agencyId: string,
    opts?: { state?: string; limit?: number; openOnly?: boolean },
  ): Promise<RcsCallEnriched[]> {
    const r = await ddb.send(
      new QueryCommand({
        TableName: this.callsTable(),
        IndexName: "agencyId-updatedAt-index",
        KeyConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":a": agencyId },
        ScanIndexForward: false,
        Limit: Math.max(opts?.limit ?? 50, opts?.state || opts?.openOnly ? 200 : opts?.limit ?? 50),
      }),
    );
    let items = ((r.Items as RcsCallDdbItem[]) ?? []).map((i) => this.toCall(i));
    if (opts?.state) items = items.filter((i) => i.state === opts.state);
    if (opts?.openOnly) items = items.filter((i) => !CLOSED.has(i.state));
    return items.slice(0, opts?.limit ?? 50);
  }

  /** Paginated scan of open calls for scheduled workers. */
  async scanOpenCalls(opts?: {
    limit?: number;
    exclusiveStartKey?: Record<string, unknown>;
  }): Promise<{ items: RcsCallEnriched[]; lastKey?: Record<string, unknown> }> {
    const r = await ddb.send(
      new ScanCommand({
        TableName: this.callsTable(),
        Limit: opts?.limit ?? 25,
        ExclusiveStartKey: opts?.exclusiveStartKey,
        FilterExpression: "attribute_exists(agencyId) AND attribute_exists(#st)",
        ExpressionAttributeNames: { "#st": "state" },
      }),
    );
    const items = ((r.Items as RcsCallDdbItem[]) ?? [])
      .map((i) => this.toCall(i))
      .filter((c) => !CLOSED.has(c.state));
    return {
      items,
      lastKey: r.LastEvaluatedKey as Record<string, unknown> | undefined,
    };
  }

  private toCall(item: RcsCallDdbItem): RcsCallEnriched {
    const { entityType: _e, ...rest } = item;
    return rest;
  }

  async putUnitPosition(
    unit: Omit<RcsUnitDdbItem, "entityType" | "pk" | "sk">,
  ): Promise<void> {
    const item: RcsUnitDdbItem = {
      ...unit,
      entityType: "rcs_unit",
      ...unitKey(unit.agencyId, unit.unitId),
    };
    await ddb.send(new PutCommand({ TableName: this.unitsTable(), Item: item }));
  }

  async getUnit(agencyId: string, unitId: string): Promise<RcsUnitDdbItem | null> {
    const r = await ddb.send(
      new GetCommand({ TableName: this.unitsTable(), Key: unitKey(agencyId, unitId) }),
    );
    return (r.Item as RcsUnitDdbItem) ?? null;
  }

  async listUnitsForAgency(agencyId: string): Promise<RcsUnitDdbItem[]> {
    const r = await ddb.send(
      new QueryCommand({
        TableName: this.unitsTable(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: { ":pk": `AGENCY#${agencyId}`, ":prefix": "UNIT#" },
      }),
    );
    return (r.Items as RcsUnitDdbItem[]) ?? [];
  }

  async recordEscalationSchedule(item: {
    callId: string;
    agencyId: string;
    level: RcsEscalationLevel;
    scheduleName: string;
    firesAt: string;
  }): Promise<void> {
    const row: RcsEscalationScheduleItem = {
      entityType: "rcs_escalation_schedule",
      ...escalationKey(item.callId, item.scheduleName),
      ...item,
      createdAt: new Date().toISOString(),
    };
    await ddb.send(new PutCommand({ TableName: this.escalationTable(), Item: row }));
  }

  async listEscalationSchedules(callId: string): Promise<RcsEscalationScheduleItem[]> {
    const r = await ddb.send(
      new QueryCommand({
        TableName: this.escalationTable(),
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": `CALL#${callId}` },
      }),
    );
    return (r.Items as RcsEscalationScheduleItem[]) ?? [];
  }

  async deleteEscalationSchedule(callId: string, scheduleName: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: this.escalationTable(),
        Key: escalationKey(callId, scheduleName),
      }),
    );
  }

  async getEscalationRules(agencyId: string): Promise<RcsEscalationRules> {
    const r = await ddb.send(
      new GetCommand({ TableName: this.escalationTable(), Key: rulesKey(agencyId) }),
    );
    const item = r.Item as RcsEscalationRulesItem | undefined;
    if (!item) {
      return {
        agencyId,
        ...RCS_ESCALATION_RULES_DEFAULTS,
        updatedAt: new Date(0).toISOString(),
        updatedByUserId: "system",
      };
    }
    const { entityType: _e, pk: _p, sk: _s, ...rest } = item;
    return rest;
  }

  async putEscalationRules(rules: RcsEscalationRules): Promise<void> {
    const item: RcsEscalationRulesItem = {
      ...rules,
      entityType: "rcs_escalation_rules",
      ...rulesKey(rules.agencyId),
    };
    await ddb.send(new PutCommand({ TableName: this.escalationTable(), Item: item }));
  }
}

export type RcsUnitScenePick = Pick<RcsUnit, "unitId" | "callSign" | "onScene" | "distanceMeters">;
