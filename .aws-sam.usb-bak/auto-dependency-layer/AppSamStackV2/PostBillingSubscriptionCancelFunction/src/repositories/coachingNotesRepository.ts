import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";
import type { CoachingNote } from "rapid-cortex-shared";

export type CoachingNoteRow = CoachingNote & {
  pk: string;
  agencyDispatcherKey: string;
  deletedAt?: string;
};

function pk(agencyId: string, noteId: string): string {
  return `${agencyId}#${noteId}`;
}

function agencyDispatcherKey(agencyId: string, dispatcherId: string): string {
  return `${agencyId}#${dispatcherId}`;
}

function toRow(note: CoachingNote, deletedAt?: string): CoachingNoteRow {
  return {
    ...note,
    pk: pk(note.agencyId, note.noteId),
    agencyDispatcherKey: agencyDispatcherKey(note.agencyId, note.dispatcherId),
    ...(deletedAt ? { deletedAt } : {}),
  };
}

function fromRow(row: CoachingNoteRow): CoachingNote {
  const { pk: _pk, agencyDispatcherKey: _adk, deletedAt: _del, ...note } = row;
  return note;
}

export class CoachingNotesRepository {
  private requireTable(): string {
    const t = env.coachingNotesTable;
    if (!t) throw new Error("COACHING_NOTES_TABLE_NOT_CONFIGURED");
    return t;
  }

  async put(note: CoachingNote): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.requireTable(),
        Item: toRow(note),
      }),
    );
  }

  async get(agencyId: string, noteId: string): Promise<CoachingNote | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: this.requireTable(),
        Key: { pk: pk(agencyId, noteId) },
      }),
    );
    if (!out.Item) return null;
    const row = out.Item as CoachingNoteRow;
    if (row.deletedAt) return null;
    return fromRow(row);
  }

  async listForDispatcher(
    agencyId: string,
    dispatcherId: string,
    limit = 50,
  ): Promise<CoachingNote[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.requireTable(),
        IndexName: "agencyDispatcherKey-createdAt-index",
        KeyConditionExpression: "agencyDispatcherKey = :k",
        FilterExpression: "attribute_not_exists(deletedAt)",
        ExpressionAttributeValues: { ":k": agencyDispatcherKey(agencyId, dispatcherId) },
        ScanIndexForward: false,
        Limit: Math.min(limit, 100),
      }),
    );
    return (out.Items ?? []).map((i) => fromRow(i as CoachingNoteRow));
  }

  async softDelete(agencyId: string, noteId: string, deletedAt: string): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: this.requireTable(),
        Key: { pk: pk(agencyId, noteId) },
        UpdateExpression: "SET deletedAt = :d, updatedAt = :d",
        ConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":d": deletedAt, ":a": agencyId },
      }),
    );
  }

  async patch(
    agencyId: string,
    noteId: string,
    updates: Partial<Pick<CoachingNote, "content" | "tags">> & { updatedAt: string },
  ): Promise<CoachingNote | null> {
    const names: Record<string, string> = { "#u": "updatedAt" };
    const values: Record<string, unknown> = { ":u": updates.updatedAt };
    const sets: string[] = ["#u = :u"];

    if (updates.content !== undefined) {
      names["#c"] = "content";
      values[":c"] = updates.content;
      sets.push("#c = :c");
    }
    if (updates.tags !== undefined) {
      names["#t"] = "tags";
      values[":t"] = updates.tags;
      sets.push("#t = :t");
    }

    const out = await ddb.send(
      new UpdateCommand({
        TableName: this.requireTable(),
        Key: { pk: pk(agencyId, noteId) },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: { ...values, ":a": agencyId },
        ConditionExpression: "agencyId = :a AND attribute_not_exists(deletedAt)",
        ReturnValues: "ALL_NEW",
      }),
    );
    if (!out.Attributes) return null;
    return fromRow(out.Attributes as CoachingNoteRow);
  }
}
