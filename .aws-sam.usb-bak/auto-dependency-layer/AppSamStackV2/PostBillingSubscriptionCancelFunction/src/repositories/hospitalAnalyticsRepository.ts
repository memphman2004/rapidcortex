import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { HospitalDailyMetrics } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export type HospitalDailyMetricsRow = HospitalDailyMetrics & {
  pk: string;
  sk: string;
  ttl: number;
};

function pk(agencyId: string): string {
  return `AGENCY#${agencyId}`;
}

function sk(hospitalId: string, date: string): string {
  return `HISTORY#${hospitalId}#${date}`;
}

function historyPrefix(hospitalId: string): string {
  return `HISTORY#${hospitalId}#`;
}

function toRow(metrics: HospitalDailyMetrics): HospitalDailyMetricsRow {
  return {
    ...metrics,
    pk: pk(metrics.agencyId),
    sk: sk(metrics.hospitalId, metrics.date),
    ttl: Math.floor(Date.now() / 1000) + 86400 * 90,
  };
}

function fromRow(row: HospitalDailyMetricsRow): HospitalDailyMetrics {
  const { pk: _pk, sk: _sk, ttl: _ttl, ...metrics } = row;
  return metrics;
}

export class HospitalAnalyticsRepository {
  private requireTable(): string {
    const t = env.hospitalCapacityTable;
    if (!t) throw new Error("HOSPITAL_CAPACITY_TABLE_NOT_CONFIGURED");
    return t;
  }

  async putDailyMetrics(metrics: HospitalDailyMetrics): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.requireTable(),
        Item: toRow(metrics),
      }),
    );
  }

  async listDailyMetrics(
    agencyId: string,
    hospitalId: string,
    startDate: string,
    endDate: string,
  ): Promise<HospitalDailyMetrics[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.requireTable(),
        KeyConditionExpression: "pk = :pk AND sk BETWEEN :start AND :end",
        ExpressionAttributeValues: {
          ":pk": pk(agencyId),
          ":start": sk(hospitalId, startDate),
          ":end": sk(hospitalId, endDate),
        },
        ScanIndexForward: true,
      }),
    );
    return (out.Items ?? []).map((row) => fromRow(row as HospitalDailyMetricsRow));
  }

  async getDailyMetrics(
    agencyId: string,
    hospitalId: string,
    date: string,
  ): Promise<HospitalDailyMetrics | null> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.requireTable(),
        KeyConditionExpression: "pk = :pk AND sk = :sk",
        ExpressionAttributeValues: {
          ":pk": pk(agencyId),
          ":sk": sk(hospitalId, date),
        },
        Limit: 1,
      }),
    );
    const row = out.Items?.[0] as HospitalDailyMetricsRow | undefined;
    return row ? fromRow(row) : null;
  }

  historySkPrefix(hospitalId: string): string {
    return historyPrefix(hospitalId);
  }
}
