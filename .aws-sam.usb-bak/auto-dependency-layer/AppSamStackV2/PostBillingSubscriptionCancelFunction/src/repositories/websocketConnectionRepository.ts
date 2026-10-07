import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

export type WebSocketConnectionRecord = {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  GSI2PK: string;
  GSI2SK: string;
  connectionId: string;
  userId: string;
  agencyId: string;
  role: string;
  displayName: string;
  connectedAt: string;
  ttl: number;
};

const CONNECTION_TTL_SECONDS = 24 * 60 * 60;

export class WebSocketConnectionRepository {
  private table(): string {
    const t = env.websocketConnectionsTable?.trim();
    if (!t) throw new Error("WEBSOCKET_CONNECTIONS_UNAVAILABLE");
    return t;
  }

  async putConnection(params: {
    connectionId: string;
    userId: string;
    agencyId: string;
    role: string;
    displayName: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + CONNECTION_TTL_SECONDS;
    const item: WebSocketConnectionRecord = {
      PK: `USER#${params.userId}`,
      SK: `CONNECTION#${params.connectionId}`,
      GSI1PK: `CONNECTION#${params.connectionId}`,
      GSI1SK: `USER#${params.userId}`,
      GSI2PK: `AGENCY#${params.agencyId}`,
      GSI2SK: `USER#${params.userId}#${params.connectionId}`,
      connectionId: params.connectionId,
      userId: params.userId,
      agencyId: params.agencyId,
      role: params.role,
      displayName: params.displayName,
      connectedAt: now,
      ttl,
    };
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: item,
      }),
    );
  }

  async deleteByConnectionId(connectionId: string): Promise<void> {
    const found = await this.findByConnectionId(connectionId);
    if (!found) return;
    await ddb.send(
      new DeleteCommand({
        TableName: this.table(),
        Key: { PK: found.PK, SK: found.SK },
      }),
    );
  }

  async findByConnectionId(connectionId: string): Promise<WebSocketConnectionRecord | null> {
    const res = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: { ":pk": `CONNECTION#${connectionId}` },
        Limit: 1,
      }),
    );
    const row = res.Items?.[0] as WebSocketConnectionRecord | undefined;
    return row ?? null;
  }

  async listByUserId(userId: string): Promise<WebSocketConnectionRecord[]> {
    const res = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": `USER#${userId}` },
      }),
    );
    return (res.Items ?? []) as WebSocketConnectionRecord[];
  }

  async listByAgencyId(agencyId: string): Promise<WebSocketConnectionRecord[]> {
    const res = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "GSI2",
        KeyConditionExpression: "GSI2PK = :pk",
        ExpressionAttributeValues: { ":pk": `AGENCY#${agencyId}` },
      }),
    );
    return (res.Items ?? []) as WebSocketConnectionRecord[];
  }
}
