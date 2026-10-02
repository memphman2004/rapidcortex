import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { WarRoomMessage } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export type WarRoomMessageRow = WarRoomMessage & { sk: string };

function sk(createdAt: string, messageId: string): string {
  return `${createdAt}#${messageId}`;
}

function toRow(msg: WarRoomMessage): WarRoomMessageRow {
  return { ...msg, sk: sk(msg.createdAt, msg.messageId) };
}

function fromRow(row: WarRoomMessageRow): WarRoomMessage {
  const { sk: _sk, ...msg } = row;
  return msg;
}

export class WarRoomMessageRepository {
  private requireTable(): string {
    const t = env.warRoomMessagesTable;
    if (!t) throw new Error("WAR_ROOM_MESSAGES_TABLE_NOT_CONFIGURED");
    return t;
  }

  async put(msg: WarRoomMessage): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.requireTable(),
        Item: toRow(msg),
      }),
    );
  }

  async listByRoom(roomId: string, limit = 200): Promise<WarRoomMessage[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.requireTable(),
        KeyConditionExpression: "roomId = :r",
        ExpressionAttributeValues: { ":r": roomId },
        ScanIndexForward: true,
        Limit: limit,
      }),
    );
    return (out.Items ?? []).map((i) => fromRow(i as WarRoomMessageRow));
  }

  async get(roomId: string, createdAt: string, messageId: string): Promise<WarRoomMessage | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: this.requireTable(),
        Key: { roomId, sk: sk(createdAt, messageId) },
      }),
    );
    if (!out.Item) return null;
    return fromRow(out.Item as WarRoomMessageRow);
  }

  async setPinned(
    roomId: string,
    createdAt: string,
    messageId: string,
    pinned: boolean,
  ): Promise<WarRoomMessage | null> {
    const out = await ddb.send(
      new UpdateCommand({
        TableName: this.requireTable(),
        Key: { roomId, sk: sk(createdAt, messageId) },
        UpdateExpression: "SET pinned = :p",
        ExpressionAttributeValues: { ":p": pinned },
        ReturnValues: "ALL_NEW",
      }),
    );
    if (!out.Attributes) return null;
    return fromRow(out.Attributes as WarRoomMessageRow);
  }
}
