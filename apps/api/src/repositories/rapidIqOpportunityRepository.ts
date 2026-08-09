/**
 * Rapid IQ opportunities — RC-global (no agencyId). RBAC at handlers.
 */
import { GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { RapidIqOpportunity, UpdateOpportunityBody } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

function table(): string {
  const t = env.rapidIqOpportunitiesTable;
  if (!t) throw new Error("RAPID_IQ_OPPORTUNITIES_TABLE_NOT_CONFIGURED");
  return t;
}

export class RapidIqOpportunityRepository {
  async get(opportunityId: string): Promise<RapidIqOpportunity | null> {
    const r = await ddb.send(new GetCommand({ TableName: table(), Key: { opportunityId } }));
    return (r.Item as RapidIqOpportunity | undefined) ?? null;
  }

  async put(opp: RapidIqOpportunity): Promise<void> {
    await ddb.send(new PutCommand({ TableName: table(), Item: opp }));
  }

  async list(opts?: { vertical?: string; status?: string }): Promise<RapidIqOpportunity[]> {
    if (opts?.vertical) {
      const r = await ddb.send(
        new QueryCommand({
          TableName: table(),
          IndexName: "vertical-score-index",
          KeyConditionExpression: "vertical = :v",
          ExpressionAttributeValues: { ":v": opts.vertical },
          ScanIndexForward: false,
        }),
      );
      return (r.Items as RapidIqOpportunity[]) ?? [];
    }
    if (opts?.status) {
      const r = await ddb.send(
        new QueryCommand({
          TableName: table(),
          IndexName: "status-detected-index",
          KeyConditionExpression: "#s = :s",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: { ":s": opts.status },
          ScanIndexForward: false,
        }),
      );
      return (r.Items as RapidIqOpportunity[]) ?? [];
    }
    const items: RapidIqOpportunity[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const r = await ddb.send(new ScanCommand({ TableName: table(), ExclusiveStartKey }));
      items.push(...((r.Items as RapidIqOpportunity[]) ?? []));
      ExclusiveStartKey = r.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (ExclusiveStartKey);
    return items.sort((a, b) => b.opportunityScore - a.opportunityScore);
  }

  async update(opportunityId: string, patch: UpdateOpportunityBody): Promise<RapidIqOpportunity | null> {
    const existing = await this.get(opportunityId);
    if (!existing) return null;
    const next: RapidIqOpportunity = {
      ...existing,
      ...patch,
      tags: patch.tags ?? existing.tags,
      lastRefreshedAt: new Date().toISOString(),
    };
    await this.put(next);
    return next;
  }

  async markConverted(opportunityId: string, leadId: string): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: table(),
        Key: { opportunityId },
        UpdateExpression: "SET #s = :s, convertedLeadId = :l, lastRefreshedAt = :t",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":s": "converted",
          ":l": leadId,
          ":t": new Date().toISOString(),
        },
      }),
    );
  }
}
