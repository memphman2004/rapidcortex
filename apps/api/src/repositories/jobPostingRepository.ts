import {
  DynamoDBClient,
  type DynamoDBClientConfig,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { JobPosting, PostingStatus } from "rapid-cortex-shared";
import { env } from "../lib/env.js";

const clientConfig: DynamoDBClientConfig = {};
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig), {
  marshallOptions: { removeUndefinedValues: true },
});

export class JobPostingRepository {
  private table(): string {
    const t = env.jobPostingsTable;
    if (!t) throw new Error("JOB_POSTINGS_TABLE is not configured");
    return t;
  }

  async put(item: JobPosting): Promise<void> {
    await ddb.send(new PutCommand({ TableName: this.table(), Item: item }));
  }

  async getById(postingId: string): Promise<JobPosting | null> {
    const { Item } = await ddb.send(
      new GetCommand({ TableName: this.table(), Key: { postingId } }),
    );
    return (Item as JobPosting | undefined) ?? null;
  }

  async getBySlug(slug: string): Promise<JobPosting | null> {
    const { Items } = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "SlugIndex",
        KeyConditionExpression: "#slug = :slug",
        ExpressionAttributeNames: { "#slug": "slug" },
        ExpressionAttributeValues: { ":slug": slug },
        Limit: 1,
      }),
    );
    return (Items?.[0] as JobPosting | undefined) ?? null;
  }

  async listPublished(): Promise<JobPosting[]> {
    const { Items } = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "StatusPublishedAtIndex",
        KeyConditionExpression: "#status = :pub",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":pub": "PUBLISHED" },
        ScanIndexForward: false,
      }),
    );
    return (Items as JobPosting[] | undefined) ?? [];
  }

  async listAll(): Promise<JobPosting[]> {
    const { Items } = await ddb.send(new ScanCommand({ TableName: this.table() }));
    const rows = (Items as JobPosting[] | undefined) ?? [];
    return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async update(
    postingId: string,
    patch: Partial<JobPosting> & { status?: PostingStatus },
  ): Promise<JobPosting | null> {
    const now = new Date().toISOString();
    const sets: string[] = ["updatedAt = :now"];
    const names: Record<string, string> = {};
    const vals: Record<string, unknown> = { ":now": now };

    const allowed = [
      "title",
      "subtitle",
      "department",
      "positionKey",
      "engagementType",
      "workLocation",
      "compensationMin",
      "compensationMax",
      "compensationUnit",
      "summary",
      "description",
      "requirements",
      "preferredQualifications",
      "whatYouGain",
      "technologyList",
      "status",
      "applicationCount",
    ] as const;

    for (const key of allowed) {
      if (patch[key] !== undefined) {
        sets.push(`#${key} = :${key}`);
        names[`#${key}`] = key;
        vals[`:${key}`] = patch[key];
      }
    }

    if (patch.status === "PUBLISHED") {
      sets.push("publishedAt = if_not_exists(publishedAt, :now)");
    }
    if (patch.status === "ARCHIVED") {
      sets.push("archivedAt = :now");
    }

    if (sets.length === 1) {
      return this.getById(postingId);
    }

    const { Attributes } = await ddb.send(
      new UpdateCommand({
        TableName: this.table(),
        Key: { postingId },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
        ExpressionAttributeValues: vals,
        ReturnValues: "ALL_NEW",
        ConditionExpression: "attribute_exists(postingId)",
      }),
    );
    return (Attributes as JobPosting | undefined) ?? null;
  }
}
