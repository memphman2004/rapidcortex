import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { PostIncidentReview, PostIncidentReviewStatus } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export type PostIncidentReviewRow = PostIncidentReview & { pk: string };

function pk(agencyId: string, reviewId: string): string {
  return `${agencyId}#${reviewId}`;
}

function toRow(review: PostIncidentReview): PostIncidentReviewRow {
  return { ...review, pk: pk(review.agencyId, review.reviewId) };
}

function fromRow(row: PostIncidentReviewRow): PostIncidentReview {
  const { pk: _pk, ...review } = row;
  return review;
}

export class PostIncidentReviewRepository {
  private requireTable(): string {
    const t = env.postIncidentReviewsTable;
    if (!t) throw new Error("POST_INCIDENT_REVIEWS_TABLE_NOT_CONFIGURED");
    return t;
  }

  async put(review: PostIncidentReview): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.requireTable(),
        Item: toRow(review),
      }),
    );
  }

  async get(agencyId: string, reviewId: string): Promise<PostIncidentReview | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: this.requireTable(),
        Key: { pk: pk(agencyId, reviewId) },
      }),
    );
    if (!out.Item) return null;
    return fromRow(out.Item as PostIncidentReviewRow);
  }

  async listByIncident(
    agencyId: string,
    incidentId: string,
    status?: PostIncidentReviewStatus,
    limit = 50,
  ): Promise<PostIncidentReview[]> {
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
    let rows = (out.Items ?? []).map((i) => fromRow(i as PostIncidentReviewRow));
    if (status) rows = rows.filter((r) => r.status === status);
    return rows;
  }

  async listForAgency(
    agencyId: string,
    status?: PostIncidentReviewStatus,
    limit = 100,
  ): Promise<PostIncidentReview[]> {
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
    let rows = (out.Items ?? []).map((i) => fromRow(i as PostIncidentReviewRow));
    if (status) rows = rows.filter((r) => r.status === status);
    return rows;
  }

  async patch(
    agencyId: string,
    reviewId: string,
    updates: Partial<
      Pick<
        PostIncidentReview,
        "sections" | "linkedScorecardIds" | "linkedTimelineEventIds" | "status" | "finalizedAt"
      >
    > & { updatedAt: string },
  ): Promise<PostIncidentReview | null> {
    const names: Record<string, string> = { "#u": "updatedAt" };
    const values: Record<string, unknown> = { ":u": updates.updatedAt, ":aid": agencyId };
    const sets: string[] = ["#u = :u"];

    if (updates.sections !== undefined) {
      names["#sec"] = "sections";
      values[":sec"] = updates.sections;
      sets.push("#sec = :sec");
    }
    if (updates.linkedScorecardIds !== undefined) {
      names["#sc"] = "linkedScorecardIds";
      values[":sc"] = updates.linkedScorecardIds;
      sets.push("#sc = :sc");
    }
    if (updates.linkedTimelineEventIds !== undefined) {
      names["#tl"] = "linkedTimelineEventIds";
      values[":tl"] = updates.linkedTimelineEventIds;
      sets.push("#tl = :tl");
    }
    if (updates.status !== undefined) {
      names["#st"] = "status";
      values[":st"] = updates.status;
      sets.push("#st = :st");
    }
    if (updates.finalizedAt !== undefined) {
      names["#fa"] = "finalizedAt";
      values[":fa"] = updates.finalizedAt;
      sets.push("#fa = :fa");
    }

    const out = await ddb.send(
      new UpdateCommand({
        TableName: this.requireTable(),
        Key: { pk: pk(agencyId, reviewId) },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ConditionExpression: "agencyId = :aid",
        ReturnValues: "ALL_NEW",
      }),
    );
    if (!out.Attributes) return null;
    return fromRow(out.Attributes as PostIncidentReviewRow);
  }
}
