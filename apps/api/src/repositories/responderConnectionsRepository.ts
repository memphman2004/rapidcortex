import { DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { ResponderConnection } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

const TTL_SECONDS = 4 * 60 * 60;

export class ResponderConnectionsRepository {
  private table(): string {
    const t = env.responderConnectionsTable?.trim();
    if (!t) throw new Error("RESPONDER_CONNECTIONS_DISABLED");
    return t;
  }

  async put(params: {
    connectionId: string;
    incidentId: string;
    userId: string;
    userRole: string;
    agencyId: string;
    displayName?: string;
  }): Promise<ResponderConnection> {
    const connectedAt = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + TTL_SECONDS;
    const item = {
      connectionId: params.connectionId,
      incidentId: params.incidentId,
      userId: params.userId,
      userRole: params.userRole,
      agencyId: params.agencyId,
      displayName: params.displayName,
      audioAuthorized: false,
      connectedAt,
      ttl,
    };
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: item,
      }),
    );
    return {
      connectionId: item.connectionId,
      incidentId: item.incidentId,
      userId: item.userId,
      userRole: item.userRole as ResponderConnection["userRole"],
      agencyId: item.agencyId,
      displayName: item.displayName,
      audioAuthorized: false,
      connectedAt,
      ttl,
    };
  }

  async get(connectionId: string): Promise<ResponderConnection | null> {
    const res = await ddb.send(
      new GetCommand({
        TableName: this.table(),
        Key: { connectionId },
      }),
    );
    if (!res.Item) return null;
    return res.Item as ResponderConnection;
  }

  async delete(connectionId: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: this.table(),
        Key: { connectionId },
      }),
    );
  }

  async listByIncident(incidentId: string, agencyId: string): Promise<ResponderConnection[]> {
    const res = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "incidentId-index",
        KeyConditionExpression: "incidentId = :incidentId",
        ExpressionAttributeValues: { ":incidentId": incidentId, ":agencyId": agencyId },
        FilterExpression: "agencyId = :agencyId",
      }),
    );
    return (res.Items ?? []) as ResponderConnection[];
  }

  async authorizeAudio(connectionId: string, incidentId: string, agencyId: string): Promise<ResponderConnection> {
    const now = new Date().toISOString();
    const res = await ddb.send(
      new UpdateCommand({
        TableName: this.table(),
        Key: { connectionId },
        ConditionExpression: "incidentId = :incidentId AND agencyId = :agencyId",
        UpdateExpression: "SET audioAuthorized = :true, audioAuthorizedAt = :now",
        ExpressionAttributeValues: {
          ":incidentId": incidentId,
          ":agencyId": agencyId,
          ":true": true,
          ":now": now,
        },
        ReturnValues: "ALL_NEW",
      }),
    );
    return res.Attributes as ResponderConnection;
  }
}
