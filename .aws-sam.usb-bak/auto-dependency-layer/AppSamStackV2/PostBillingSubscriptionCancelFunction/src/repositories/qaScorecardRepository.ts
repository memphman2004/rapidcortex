import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";
import type { QaScorecard } from "rapid-cortex-shared";

export type QaScorecardRow = QaScorecard & {
  pk: string;
  agencyDispatcherKey: string;
};

function pk(agencyId: string, scorecardId: string): string {
  return `${agencyId}#${scorecardId}`;
}

function agencyDispatcherKey(agencyId: string, dispatcherId: string): string {
  return `${agencyId}#${dispatcherId}`;
}

function toRow(card: QaScorecard): QaScorecardRow {
  return {
    ...card,
    pk: pk(card.agencyId, card.scorecardId),
    agencyDispatcherKey: agencyDispatcherKey(card.agencyId, card.dispatcherId),
  };
}

function fromRow(row: QaScorecardRow): QaScorecard {
  const { pk: _pk, agencyDispatcherKey: _adk, ...card } = row;
  return card;
}

export class QaScorecardRepository {
  private requireTable(): string {
    const t = env.qaScorecardsTable;
    if (!t) throw new Error("QA_SCORECARDS_TABLE_NOT_CONFIGURED");
    return t;
  }

  async put(card: QaScorecard): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.requireTable(),
        Item: toRow(card),
      }),
    );
  }

  async get(agencyId: string, scorecardId: string): Promise<QaScorecard | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: this.requireTable(),
        Key: { pk: pk(agencyId, scorecardId) },
      }),
    );
    if (!out.Item) return null;
    return fromRow(out.Item as QaScorecardRow);
  }

  async listByDispatcher(
    agencyId: string,
    dispatcherId: string,
    limit = 50,
  ): Promise<QaScorecard[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.requireTable(),
        IndexName: "agencyDispatcherKey-createdAt-index",
        KeyConditionExpression: "agencyDispatcherKey = :k",
        ExpressionAttributeValues: { ":k": agencyDispatcherKey(agencyId, dispatcherId) },
        ScanIndexForward: false,
        Limit: Math.min(limit, 100),
      }),
    );
    return (out.Items ?? []).map((i) => fromRow(i as QaScorecardRow));
  }

  async listByIncident(agencyId: string, incidentId: string, limit = 50): Promise<QaScorecard[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.requireTable(),
        IndexName: "agencyId-incidentId-index",
        KeyConditionExpression: "agencyId = :a AND incidentId = :i",
        ExpressionAttributeValues: { ":a": agencyId, ":i": incidentId },
        ScanIndexForward: false,
        Limit: Math.min(limit, 100),
      }),
    );
    return (out.Items ?? []).map((i) => fromRow(i as QaScorecardRow));
  }

  async listForAgency(agencyId: string, limit = 50): Promise<QaScorecard[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.requireTable(),
        IndexName: "agencyId-createdAt-index",
        KeyConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":a": agencyId },
        ScanIndexForward: false,
        Limit: Math.min(limit, 100),
      }),
    );
    return (out.Items ?? []).map((i) => fromRow(i as QaScorecardRow));
  }

  async patch(
    agencyId: string,
    scorecardId: string,
    updates: Partial<
      Pick<QaScorecard, "items" | "overallScore" | "coachingNotes" | "followUpRequired" | "status" | "acknowledgedAt">
    > & { updatedAt: string },
  ): Promise<QaScorecard | null> {
    const names: Record<string, string> = { "#u": "updatedAt" };
    const values: Record<string, unknown> = { ":u": updates.updatedAt, ":aid": agencyId };
    const sets: string[] = ["#u = :u"];

    if (updates.items !== undefined) {
      names["#items"] = "items";
      values[":items"] = updates.items;
      sets.push("#items = :items");
    }
    if (updates.overallScore !== undefined) {
      names["#os"] = "overallScore";
      values[":os"] = updates.overallScore;
      sets.push("#os = :os");
    }
    if (updates.coachingNotes !== undefined) {
      names["#cn"] = "coachingNotes";
      values[":cn"] = updates.coachingNotes;
      sets.push("#cn = :cn");
    }
    if (updates.followUpRequired !== undefined) {
      names["#fur"] = "followUpRequired";
      values[":fur"] = updates.followUpRequired;
      sets.push("#fur = :fur");
    }
    if (updates.status !== undefined) {
      names["#st"] = "status";
      values[":st"] = updates.status;
      sets.push("#st = :st");
    }
    if (updates.acknowledgedAt !== undefined) {
      names["#aa"] = "acknowledgedAt";
      values[":aa"] = updates.acknowledgedAt;
      sets.push("#aa = :aa");
    }

    const out = await ddb.send(
      new UpdateCommand({
        TableName: this.requireTable(),
        Key: { pk: pk(agencyId, scorecardId) },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ConditionExpression: "agencyId = :aid",
        ReturnValues: "ALL_NEW",
      }),
    );
    if (!out.Attributes) return null;
    return fromRow(out.Attributes as QaScorecardRow);
  }
}
