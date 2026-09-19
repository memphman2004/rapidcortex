import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../../repositories/baseRepository.js";

export interface HubAuditEntry {
  hubMessageId: string;
  timestamp: string;
  messageType: string;
  sourceAgencyId: string;
  targetAgencyId: string;
  eidoMessageId: string;
  incidentId: string;
  status: "SUCCESS" | "FAILURE";
  durationMs: number;
  errorMessage?: string;
}

export class AuditLogger {
  private entries: HubAuditEntry[] = [];

  constructor(private readonly tableName = "") {}

  async write(entry: HubAuditEntry): Promise<void> {
    this.entries.push(entry);
    if (!this.tableName) return;
    await ddb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { ...entry, agencyId: entry.sourceAgencyId },
      }),
    );
  }

  async list(filter?: { agencyId?: string }): Promise<HubAuditEntry[]> {
    if (this.tableName && filter?.agencyId) {
      const result = await ddb.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: "sourceAgencyId-index",
          KeyConditionExpression: "sourceAgencyId = :a",
          ExpressionAttributeValues: { ":a": filter.agencyId },
        }),
      );
      return (result.Items ?? []) as HubAuditEntry[];
    }
    if (!filter?.agencyId) return [...this.entries];
    return this.entries.filter(
      (e) => e.sourceAgencyId === filter.agencyId || e.targetAgencyId === filter.agencyId,
    );
  }
}
