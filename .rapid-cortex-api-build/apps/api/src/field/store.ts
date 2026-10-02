import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../repositories/baseRepository.js";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";

export type FieldAccessRequestRecord = {
  agencyId: string;
  sk: string;
  requestId: string;
  requestedWorkspace: string;
  requestedWorkspaceTitle: string;
  userEmail: string;
  userId: string;
  role: string;
  reason: string;
  createdAt: string;
  itemType: "ACCESS_REQUEST";
};

export type FieldContinuityLogRecord = {
  agencyId: string;
  sk: string;
  entryId: string;
  category: string;
  text: string;
  critical: boolean;
  actorId: string;
  createdAt: string;
  itemType: "CONTINUITY_LOG";
};

export type FieldCoachingRecord = {
  agencyId: string;
  sk: string;
  noteId: string;
  incidentId?: string;
  dispatcherUserId: string;
  category: string;
  observation: string;
  discussInNextReview: boolean;
  addToQaQueue: boolean;
  positiveRecognition: boolean;
  actorId: string;
  createdAt: string;
  itemType: "COACHING_NOTE";
};

function table(): string {
  const t = env.fieldCommandTable;
  if (!t) throw new Error("FIELD_COMMAND_TABLE_NOT_CONFIGURED");
  return t;
}

export class FieldCommandStore {
  async putAccessRequest(row: Omit<FieldAccessRequestRecord, "sk" | "itemType" | "requestId" | "createdAt"> & {
    requestId?: string;
    createdAt?: string;
  }): Promise<FieldAccessRequestRecord> {
    const requestId = row.requestId ?? makeId("far");
    const createdAt = row.createdAt ?? new Date().toISOString();
    const item: FieldAccessRequestRecord = {
      ...row,
      requestId,
      createdAt,
      sk: `ACCESS#${createdAt}#${requestId}`,
      itemType: "ACCESS_REQUEST",
    };
    await ddb.send(new PutCommand({ TableName: table(), Item: item }));
    return item;
  }

  async putContinuityLog(row: Omit<FieldContinuityLogRecord, "sk" | "itemType" | "entryId" | "createdAt"> & {
    entryId?: string;
    createdAt?: string;
  }): Promise<FieldContinuityLogRecord> {
    const entryId = row.entryId ?? makeId("flog");
    const createdAt = row.createdAt ?? new Date().toISOString();
    const item: FieldContinuityLogRecord = {
      ...row,
      entryId,
      createdAt,
      sk: `LOG#${createdAt}#${entryId}`,
      itemType: "CONTINUITY_LOG",
    };
    await ddb.send(new PutCommand({ TableName: table(), Item: item }));
    return item;
  }

  async listContinuityLogs(agencyId: string, limit = 80): Promise<FieldContinuityLogRecord[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "agencyId = :a AND begins_with(#sk, :p)",
        ExpressionAttributeNames: { "#sk": "sk" },
        ExpressionAttributeValues: { ":a": agencyId, ":p": "LOG#" },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (out.Items ?? []) as FieldContinuityLogRecord[];
  }

  async putCoachingNote(row: Omit<FieldCoachingRecord, "sk" | "itemType" | "noteId" | "createdAt"> & {
    noteId?: string;
    createdAt?: string;
  }): Promise<FieldCoachingRecord> {
    const noteId = row.noteId ?? makeId("fcoach");
    const createdAt = row.createdAt ?? new Date().toISOString();
    const item: FieldCoachingRecord = {
      ...row,
      noteId,
      createdAt,
      sk: `COACH#${createdAt}#${noteId}`,
      itemType: "COACHING_NOTE",
    };
    await ddb.send(new PutCommand({ TableName: table(), Item: item }));
    return item;
  }

  async putMessage(params: {
    agencyId: string;
    incidentId: string;
    actorId: string;
    text: string;
  }): Promise<{ messageId: string; createdAt: string }> {
    const messageId = makeId("fmsg");
    const createdAt = new Date().toISOString();
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          agencyId: params.agencyId,
          sk: `MSG#${params.incidentId}#${createdAt}#${messageId}`,
          messageId,
          incidentId: params.incidentId,
          actorId: params.actorId,
          text: params.text,
          createdAt,
          itemType: "WORKSTATION_MESSAGE",
        },
      }),
    );
    return { messageId, createdAt };
  }

  async putQaFlag(params: {
    agencyId: string;
    incidentId: string;
    actorId: string;
  }): Promise<{ flagId: string }> {
    const flagId = makeId("fqa");
    const createdAt = new Date().toISOString();
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          agencyId: params.agencyId,
          sk: `QAFLAG#${params.incidentId}#${flagId}`,
          flagId,
          incidentId: params.incidentId,
          actorId: params.actorId,
          createdAt,
          itemType: "QA_FLAG",
        },
      }),
    );
    return { flagId };
  }

  async putFollow(params: {
    agencyId: string;
    incidentId: string;
    actorId: string;
  }): Promise<void> {
    const createdAt = new Date().toISOString();
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          agencyId: params.agencyId,
          sk: `FOLLOW#${params.incidentId}#${params.actorId}`,
          incidentId: params.incidentId,
          actorId: params.actorId,
          createdAt,
          itemType: "FOLLOW",
        },
      }),
    );
  }
}

export const fieldCommandStore = new FieldCommandStore();
