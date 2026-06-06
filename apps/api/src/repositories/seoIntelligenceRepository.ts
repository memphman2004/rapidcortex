import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { SeoIssueRecord, SeoIssueStatus, SeoScanRecord } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

type DynamoScanItem = SeoScanRecord & { sk: string };
type DynamoIssueItem = SeoIssueRecord & { sk: string };

export class SeoIntelligenceRepository {
  private table(): string {
    const t = env.seoIntelligenceTable;
    if (!t) throw new Error("SEO_INTELLIGENCE_UNAVAILABLE");
    return t;
  }

  async putScan(agencyId: string, record: SeoScanRecord): Promise<void> {
    const item: DynamoScanItem = {
      ...record,
      sk: `SCAN#${record.id}`,
    };
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: item,
      }),
    );
  }

  async getScan(agencyId: string, scanId: string): Promise<SeoScanRecord | null> {
    const res = await ddb.send(
      new GetCommand({
        TableName: this.table(),
        Key: { agencyId, sk: `SCAN#${scanId}` },
      }),
    );
    const it = res.Item as DynamoScanItem | undefined;
    if (!it) return null;
    const { sk: _sk, ...rest } = it;
    return rest;
  }

  async listScans(agencyId: string, limit = 50): Promise<SeoScanRecord[]> {
    const res = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        KeyConditionExpression: "agencyId = :a AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":a": agencyId, ":p": "SCAN#" },
        Limit: limit,
      }),
    );
    const rows = (res.Items ?? []) as DynamoScanItem[];
    const scans = rows.map(({ sk: _sk, ...rest }) => rest as SeoScanRecord);
    scans.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return scans;
  }

  async putIssue(agencyId: string, record: SeoIssueRecord): Promise<void> {
    const item: DynamoIssueItem = {
      ...record,
      sk: `ISSUE#${record.id}`,
    };
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: item,
      }),
    );
  }

  async getIssue(agencyId: string, issueId: string): Promise<SeoIssueRecord | null> {
    const res = await ddb.send(
      new GetCommand({
        TableName: this.table(),
        Key: { agencyId, sk: `ISSUE#${issueId}` },
      }),
    );
    const it = res.Item as DynamoIssueItem | undefined;
    if (!it) return null;
    const { sk: _sk, ...rest } = it;
    return rest;
  }

  async listIssues(agencyId: string, limit = 100): Promise<SeoIssueRecord[]> {
    const res = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        KeyConditionExpression: "agencyId = :a AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":a": agencyId, ":p": "ISSUE#" },
        Limit: limit,
      }),
    );
    const rows = (res.Items ?? []) as DynamoIssueItem[];
    const issues = rows.map(({ sk: _sk, ...rest }) => rest as SeoIssueRecord);
    issues.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return issues;
  }

  async updateIssueStatus(agencyId: string, issueId: string, status: SeoIssueStatus): Promise<SeoIssueRecord | null> {
    const updatedAt = new Date().toISOString();
    try {
      const res = await ddb.send(
        new UpdateCommand({
          TableName: this.table(),
          Key: { agencyId, sk: `ISSUE#${issueId}` },
          UpdateExpression: "SET #s = :s, updatedAt = :u",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: { ":s": status, ":u": updatedAt },
          ConditionExpression: "attribute_exists(sk)",
          ReturnValues: "ALL_NEW",
        }),
      );
      const attrs = res.Attributes as DynamoIssueItem | undefined;
      if (!attrs) return null;
      const { sk: _sk, ...rest } = attrs;
      return rest;
    } catch {
      return null;
    }
  }
}
