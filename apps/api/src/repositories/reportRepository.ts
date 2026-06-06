import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { ReportResult } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export type ReportResultRow = ReportResult & { pk: string };

function pk(agencyId: string, reportId: string): string {
  return `${agencyId}#${reportId}`;
}

function toRow(result: ReportResult): ReportResultRow & { agencyId: string; createdAt: string } {
  return {
    ...result,
    pk: pk(result.config.agencyId, result.reportId),
    agencyId: result.config.agencyId,
    createdAt: result.config.createdAt,
  };
}

function fromRow(row: ReportResultRow): ReportResult {
  const { pk: _pk, ...result } = row;
  return result;
}

export class ReportRepository {
  private requireTable(): string {
    const t = env.agencyReportsTable;
    if (!t) throw new Error("AGENCY_REPORTS_TABLE_NOT_CONFIGURED");
    return t;
  }

  async put(result: ReportResult): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.requireTable(),
        Item: toRow(result),
      }),
    );
  }

  async get(agencyId: string, reportId: string): Promise<ReportResult | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: this.requireTable(),
        Key: { pk: pk(agencyId, reportId) },
      }),
    );
    if (!out.Item) return null;
    return fromRow(out.Item as ReportResultRow);
  }

  async listForAgency(agencyId: string, limit = 50): Promise<ReportResult[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.requireTable(),
        IndexName: "agencyId-createdAt-index",
        KeyConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":a": agencyId },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (out.Items ?? []).map((i) => fromRow(i as ReportResultRow));
  }
}
