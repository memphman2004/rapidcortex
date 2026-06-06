import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { HospitalCapacity } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export type HospitalCapacityRow = HospitalCapacity & {
  pk: string;
  sk: string;
  ttl: number;
};

function pk(agencyId: string): string {
  return `AGENCY#${agencyId}`;
}

function sk(hospitalId: string, timestamp: string): string {
  return `CAPACITY#${hospitalId}#${timestamp}`;
}

function capacityPrefix(hospitalId: string): string {
  return `CAPACITY#${hospitalId}#`;
}

function toRow(capacity: HospitalCapacity): HospitalCapacityRow {
  return {
    ...capacity,
    pk: pk(capacity.agencyId),
    sk: sk(capacity.hospitalId, capacity.timestamp),
    ttl: Math.floor(Date.now() / 1000) + 86400 * 7,
  };
}

function fromRow(row: HospitalCapacityRow): HospitalCapacity {
  const { pk: _pk, sk: _sk, ttl: _ttl, ...capacity } = row;
  return capacity;
}

export class HospitalCapacityRepository {
  private requireTable(): string {
    const t = env.hospitalCapacityTable;
    if (!t) throw new Error("HOSPITAL_CAPACITY_TABLE_NOT_CONFIGURED");
    return t;
  }

  async put(capacity: HospitalCapacity): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.requireTable(),
        Item: toRow(capacity),
      }),
    );
  }

  async getLatest(agencyId: string, hospitalId: string): Promise<HospitalCapacity | null> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.requireTable(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: {
          ":pk": pk(agencyId),
          ":prefix": capacityPrefix(hospitalId),
        },
        ScanIndexForward: false,
        Limit: 1,
      }),
    );
    const row = out.Items?.[0] as HospitalCapacityRow | undefined;
    return row ? fromRow(row) : null;
  }

  async listLatestByAgency(agencyId: string, hospitalIds: string[]): Promise<HospitalCapacity[]> {
    const results: HospitalCapacity[] = [];
    for (const hospitalId of hospitalIds) {
      const latest = await this.getLatest(agencyId, hospitalId);
      if (latest) results.push(latest);
    }
    return results;
  }

  async listRecentSnapshots(
    agencyId: string,
    hospitalId: string,
    limit = 10,
  ): Promise<HospitalCapacity[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.requireTable(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: {
          ":pk": pk(agencyId),
          ":prefix": capacityPrefix(hospitalId),
        },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (out.Items ?? []).map((row) => fromRow(row as HospitalCapacityRow));
  }

  async listSnapshotsInRange(
    agencyId: string,
    hospitalId: string,
    startIso: string,
    endIso: string,
  ): Promise<HospitalCapacity[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.requireTable(),
        KeyConditionExpression: "pk = :pk AND sk BETWEEN :start AND :end",
        ExpressionAttributeValues: {
          ":pk": pk(agencyId),
          ":start": sk(hospitalId, startIso),
          ":end": sk(hospitalId, endIso),
        },
        ScanIndexForward: true,
      }),
    );
    return (out.Items ?? []).map((row) => fromRow(row as HospitalCapacityRow));
  }
}
