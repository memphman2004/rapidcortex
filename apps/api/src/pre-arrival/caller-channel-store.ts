import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { CallerChannelMessage } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "../repositories/baseRepository.js";

function table(): string {
  const name = env.preArrivalSessionsTable;
  if (!name) throw Object.assign(new Error("PRE_ARRIVAL_TABLE_NOT_CONFIGURED"), { statusCode: 503 });
  return name;
}

function channelSk(sessionToken: string, createdAt: string, messageId: string): string {
  return `CHANNEL#${sessionToken}#${createdAt}#${messageId}`;
}

export class CallerChannelStore {
  async put(message: CallerChannelMessage): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          ...message,
          pk: `AGENCY#${message.agencyId}`,
          sk: channelSk(message.sessionToken, message.createdAt, message.messageId),
        },
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );
  }

  async list(agencyId: string, sessionToken: string, limit = 50): Promise<CallerChannelMessage[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": `AGENCY#${agencyId}`,
          ":sk": `CHANNEL#${sessionToken}#`,
        },
        Limit: limit,
        ScanIndexForward: true,
      }),
    );
    return (result.Items ?? []).map((item) => {
      const { pk: _pk, sk: _sk, ...rest } = item;
      return rest as CallerChannelMessage;
    });
  }

  async markReady(agencyId: string, sessionToken: string, createdAt: string, messageId: string): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: table(),
        Key: {
          pk: `AGENCY#${agencyId}`,
          sk: channelSk(sessionToken, createdAt, messageId),
        },
        UpdateExpression: "SET mediaStatus = :ready",
        ExpressionAttributeValues: { ":ready": "ready", ":agency": agencyId },
        ConditionExpression: "attribute_exists(pk) AND agencyId = :agency",
      }),
    );
  }
}

export const callerChannelStore = new CallerChannelStore();
