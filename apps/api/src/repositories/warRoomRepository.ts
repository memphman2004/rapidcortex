import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { WarRoom } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export type WarRoomRow = WarRoom & { pk: string };

function pk(agencyId: string, roomId: string): string {
  return `${agencyId}#${roomId}`;
}

function toRow(room: WarRoom): WarRoomRow {
  return { ...room, pk: pk(room.agencyId, room.roomId) };
}

function fromRow(row: WarRoomRow): WarRoom {
  const { pk: _pk, ...room } = row;
  return room;
}

export class WarRoomRepository {
  private requireTable(): string {
    const t = env.warRoomsTable;
    if (!t) throw new Error("WAR_ROOMS_TABLE_NOT_CONFIGURED");
    return t;
  }

  async put(room: WarRoom): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.requireTable(),
        Item: toRow(room),
      }),
    );
  }

  async get(agencyId: string, roomId: string): Promise<WarRoom | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: this.requireTable(),
        Key: { pk: pk(agencyId, roomId) },
      }),
    );
    if (!out.Item) return null;
    return fromRow(out.Item as WarRoomRow);
  }

  async listByIncident(agencyId: string, incidentId: string, limit = 20): Promise<WarRoom[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.requireTable(),
        IndexName: "agencyId-incidentId-index",
        KeyConditionExpression: "agencyId = :a AND incidentId = :i",
        ExpressionAttributeValues: { ":a": agencyId, ":i": incidentId },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (out.Items ?? []).map((i) => fromRow(i as WarRoomRow));
  }

  async listForAgency(agencyId: string, limit = 50): Promise<WarRoom[]> {
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
    return (out.Items ?? []).map((i) => fromRow(i as WarRoomRow));
  }

  async update(
    agencyId: string,
    roomId: string,
    updates: Partial<Pick<WarRoom, "status" | "participants" | "pinnedNotes" | "closedAt">> & {
      updatedAt: string;
    },
  ): Promise<WarRoom | null> {
    const names: Record<string, string> = { "#u": "updatedAt" };
    const values: Record<string, unknown> = { ":u": updates.updatedAt, ":aid": agencyId };
    const sets: string[] = ["#u = :u"];

    if (updates.status !== undefined) {
      names["#st"] = "status";
      values[":st"] = updates.status;
      sets.push("#st = :st");
    }
    if (updates.participants !== undefined) {
      names["#p"] = "participants";
      values[":p"] = updates.participants;
      sets.push("#p = :p");
    }
    if (updates.pinnedNotes !== undefined) {
      names["#pn"] = "pinnedNotes";
      values[":pn"] = updates.pinnedNotes;
      sets.push("#pn = :pn");
    }
    if (updates.closedAt !== undefined) {
      names["#ca"] = "closedAt";
      values[":ca"] = updates.closedAt;
      sets.push("#ca = :ca");
    }

    const out = await ddb.send(
      new UpdateCommand({
        TableName: this.requireTable(),
        Key: { pk: pk(agencyId, roomId) },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ConditionExpression: "agencyId = :aid",
        ReturnValues: "ALL_NEW",
      }),
    );
    if (!out.Attributes) return null;
    return fromRow(out.Attributes as WarRoomRow);
  }
}
