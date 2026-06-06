import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";
import type { DispatcherCoachingNoteRecord } from "rapid-cortex-shared";

function dispatcherKey(agencyId: string, dispatcherUserId: string): string {
  return `${agencyId}#${dispatcherUserId}`;
}

export class DispatcherCoachingRepository {
  async listForDispatcher(
    agencyId: string,
    dispatcherUserId: string,
    opts: { limit?: number } = {},
  ): Promise<DispatcherCoachingNoteRecord[]> {
    const table = env.dispatcherCoachingNotesTable;
    if (!table) return [];
    const limit = Math.min(opts.limit ?? 40, 100);
    const res = await ddb.send(
      new QueryCommand({
        TableName: table,
        IndexName: "agencyDispatcherKey-createdAt-index",
        KeyConditionExpression: "agencyDispatcherKey = :k",
        ExpressionAttributeValues: { ":k": dispatcherKey(agencyId, dispatcherUserId) },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (res.Items ?? []) as DispatcherCoachingNoteRecord[];
  }

  async create(input: Omit<DispatcherCoachingNoteRecord, "noteId"> & { noteId: string }): Promise<void> {
    const table = env.dispatcherCoachingNotesTable;
    if (!table) throw new Error("COACHING_NOTES_DISABLED");
    await ddb.send(
      new PutCommand({
        TableName: table,
        Item: {
          noteId: input.noteId,
          agencyDispatcherKey: dispatcherKey(input.agencyId, input.dispatcherUserId),
          agencyId: input.agencyId,
          dispatcherUserId: input.dispatcherUserId,
          supervisorUserId: input.supervisorUserId,
          body: input.body,
          createdAt: input.createdAt,
        },
      }),
    );
  }
}
