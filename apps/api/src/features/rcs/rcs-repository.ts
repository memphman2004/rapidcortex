import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { RcsCall, RcsEscalationLevel, RcsUnit } from "rapid-cortex-shared";
import { ddb } from "../../repositories/baseRepository.js";
import { env } from "../../lib/env.js";

export type RcsCallDdbItem = RcsCall & { entityType: "rcs_call" };

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

function unitKey(agencyId: string, unitId: string) {
  return { pk: `AGENCY#${agencyId}`, sk: `UNIT#${unitId}` };
}

function escalationKey(callId: string, scheduleName: string) {
  return { pk: `CALL#${callId}`, sk: `SCHED#${scheduleName}` };
}

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

  // ── Calls ──────────────────────────────────────────────────────────────────

  async createCall(call: RcsCall): Promise<void> {
    const item: RcsCallDdbItem = { ...call, entityType: "rcs_call" };
    await ddb.send(
      new PutCommand({
        TableName: this.callsTable(),
        Item: item,
        ConditionExpression: "attribute_not_exists(callId)",
      }),
    );
  }

  async getCall(agencyId: string, callId: string): Promise<RcsCall | null> {
    const r = await ddb.send(
      new GetCommand({ TableName: this.callsTable(), Key: { callId } }),
    );
    const item = r.Item as RcsCallDdbItem | undefined;
    if (!item || item.agencyId !== agencyId) return null;
    return this.toCall(item);
  }

  async putCall(call: RcsCall): Promise<void> {
    const item: RcsCallDdbItem = { ...call, entityType: "rcs_call" };
    await ddb.send(new PutCommand({ TableName: this.callsTable(), Item: item }));
  }

  async listCallsByAgency(
    agencyId: string,
    opts?: { state?: string; limit?: number },
  ): Promise<RcsCall[]> {
    const r = await ddb.send(
      new QueryCommand({
        TableName: this.callsTable(),
        IndexName: "agencyId-updatedAt-index",
        KeyConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":a": agencyId },
        ScanIndexForward: false,
        Limit: Math.max(opts?.limit ?? 50, opts?.state ? 200 : opts?.limit ?? 50),
      }),
    );
    const items = ((r.Items as RcsCallDdbItem[]) ?? []).map((i) => this.toCall(i));
    const filtered = opts?.state ? items.filter((i) => i.state === opts.state) : items;
    return filtered.slice(0, opts?.limit ?? 50);
  }

  private toCall(item: RcsCallDdbItem): RcsCall {
    const { entityType, ...rest } = item;
    return rest;
  }

  // ── Units ──────────────────────────────────────────────────────────────────

  async putUnitPosition(
    unit: Omit<RcsUnitDdbItem, "entityType" | "pk" | "sk">,
  ): Promise<void> {
    const item: RcsUnitDdbItem = { ...unit, entityType: "rcs_unit", ...unitKey(unit.agencyId, unit.unitId) };
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

  // ── Escalation schedules ─────────────────────────────────────────────────────

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
      new DeleteCommand({ TableName: this.escalationTable(), Key: escalationKey(callId, scheduleName) }),
    );
  }
}
