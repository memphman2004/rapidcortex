import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";
import type { IncidentShareRecord, IncidentShareStatus } from "rapid-cortex-shared";

export class IncidentShareRepository {
  private table(): string | null {
    return env.incidentSharesTable || null;
  }

  async findActiveForRecipient(incidentId: string, recipientAgencyId: string): Promise<IncidentShareRecord | null> {
    const table = this.table();
    if (!table) return null;
    const res = await ddb.send(
      new QueryCommand({
        TableName: table,
        IndexName: "incidentId-recipientAgencyId-index",
        KeyConditionExpression: "incidentId = :i AND recipientAgencyId = :r",
        ExpressionAttributeValues: {
          ":i": incidentId,
          ":r": recipientAgencyId,
          ":active": "active",
        },
        FilterExpression: "#s = :active",
        ExpressionAttributeNames: { "#s": "status" },
        Limit: 1,
      }),
    );
    const item = res.Items?.[0] as IncidentShareRecord | undefined;
    if (!item || item.status !== "active") return null;
    if (item.ttlEpoch && item.ttlEpoch * 1000 <= Date.now()) return null;
    return item;
  }

  async listForIncident(incidentId: string): Promise<IncidentShareRecord[]> {
    const table = this.table();
    if (!table) return [];
    const res = await ddb.send(
      new QueryCommand({
        TableName: table,
        IndexName: "incidentId-createdAt-index",
        KeyConditionExpression: "incidentId = :i",
        ExpressionAttributeValues: { ":i": incidentId },
        ScanIndexForward: false,
        Limit: 50,
      }),
    );
    return (res.Items ?? []) as IncidentShareRecord[];
  }

  async listIncomingForAgency(recipientAgencyId: string): Promise<IncidentShareRecord[]> {
    const table = this.table();
    if (!table) return [];
    const res = await ddb.send(
      new QueryCommand({
        TableName: table,
        IndexName: "recipientAgencyId-createdAt-index",
        KeyConditionExpression: "recipientAgencyId = :r",
        ExpressionAttributeValues: {
          ":r": recipientAgencyId,
          ":active": "active",
        },
        FilterExpression: "#s = :active",
        ExpressionAttributeNames: { "#s": "status" },
        ScanIndexForward: false,
        Limit: 100,
      }),
    );
    return (res.Items ?? []) as IncidentShareRecord[];
  }

  async get(shareId: string): Promise<IncidentShareRecord | null> {
    const table = this.table();
    if (!table) return null;
    const res = await ddb.send(
      new GetCommand({
        TableName: table,
        Key: { shareId },
      }),
    );
    return (res.Item as IncidentShareRecord) ?? null;
  }

  async create(record: IncidentShareRecord): Promise<void> {
    const table = this.table();
    if (!table) throw new Error("INCIDENT_SHARES_DISABLED");
    await ddb.send(
      new PutCommand({
        TableName: table,
        Item: record,
        ConditionExpression: "attribute_not_exists(shareId)",
      }),
    );
  }

  async setStatus(shareId: string, status: IncidentShareStatus): Promise<void> {
    const table = this.table();
    if (!table) throw new Error("INCIDENT_SHARES_DISABLED");
    await ddb.send(
      new UpdateCommand({
        TableName: table,
        Key: { shareId },
        UpdateExpression: "SET #s = :s",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":s": status },
      }),
    );
  }
}
