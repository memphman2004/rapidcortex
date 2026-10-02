import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { AgencySubscriptionRecord } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

export class AgencySubscriptionRepository {
  private table(): string {
    const t = env.agencySubscriptionsTable;
    if (!t) throw new Error("AGENCY_SUBSCRIPTIONS_DISABLED");
    return t;
  }

  async put(row: AgencySubscriptionRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: row,
      }),
    );
  }

  async get(subscriptionId: string): Promise<AgencySubscriptionRecord | null> {
    const res = await ddb.send(
      new GetCommand({
        TableName: this.table(),
        Key: { subscriptionId },
      }),
    );
    return (res.Item as AgencySubscriptionRecord | undefined) ?? null;
  }

  async listLatestByAgency(agencyId: string, limit = 5): Promise<AgencySubscriptionRecord[]> {
    const res = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "agencyId-createdAt-index",
        KeyConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":a": agencyId },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (res.Items as AgencySubscriptionRecord[]) ?? [];
  }
}
