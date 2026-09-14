import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { VideoClip } from "rapid-cortex-shared";
import { env } from "../lib/env.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function tableName(): string {
  const t = env.videoClipsTable;
  if (!t) throw new Error("VIDEO_CLIPS_TABLE not set");
  return t;
}

export class VideoClipRepository {
  async get(agencyId: string, clipId: string): Promise<VideoClip | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: tableName(),
        Key: { agencyId: agencyId.trim(), clipId: clipId.trim() },
      }),
    );
    const item = result.Item as VideoClip | undefined;
    if (!item || item.agencyId !== agencyId.trim()) return null;
    return item;
  }

  async put(clip: VideoClip): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: tableName(),
        Item: clip,
        ConditionExpression: "attribute_not_exists(clipId) OR locked <> :true",
        ExpressionAttributeValues: { ":true": true },
      }),
    );
  }

  async listByAgency(args: {
    agencyId: string;
    cameraId?: string;
    limit?: number;
    exclusiveStartKey?: Record<string, unknown>;
  }): Promise<{ clips: VideoClip[]; lastKey?: Record<string, unknown> }> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: "agencyId = :agencyId",
        FilterExpression: args.cameraId ? "cameraId = :cameraId" : undefined,
        ExpressionAttributeValues: {
          ":agencyId": args.agencyId.trim(),
          ...(args.cameraId ? { ":cameraId": args.cameraId.trim() } : {}),
        },
        Limit: Math.min(Math.max(args.limit ?? 50, 1), 100),
        ExclusiveStartKey: args.exclusiveStartKey,
        ScanIndexForward: false,
      }),
    );
    return {
      clips: (result.Items ?? []) as VideoClip[],
      lastKey: result.LastEvaluatedKey as Record<string, unknown> | undefined,
    };
  }

  async listByIncident(agencyId: string, incidentId: string): Promise<VideoClip[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        IndexName: "incidentId-index",
        KeyConditionExpression: "incidentId = :incidentId",
        FilterExpression: "agencyId = :agencyId",
        ExpressionAttributeValues: {
          ":incidentId": incidentId.trim(),
          ":agencyId": agencyId.trim(),
        },
      }),
    );
    return (result.Items ?? []) as VideoClip[];
  }

  async updateStatus(
    agencyId: string,
    clipId: string,
    fields: {
      status: VideoClip["status"];
      s3Key?: string;
      s3Bucket?: string;
      errorMessage?: string;
    },
  ): Promise<void> {
    const names: Record<string, string> = { "#st": "status" };
    const values: Record<string, unknown> = { ":status": fields.status, ":agencyId": agencyId.trim() };
    const sets = ["#st = :status"];
    if (fields.s3Key) {
      sets.push("s3Key = :s3Key");
      values[":s3Key"] = fields.s3Key;
    }
    if (fields.s3Bucket) {
      sets.push("s3Bucket = :s3Bucket");
      values[":s3Bucket"] = fields.s3Bucket;
    }
    if (fields.errorMessage !== undefined) {
      sets.push("errorMessage = :errorMessage");
      values[":errorMessage"] = fields.errorMessage;
    }
    await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { agencyId: agencyId.trim(), clipId: clipId.trim() },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ConditionExpression: "agencyId = :agencyId",
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      }),
    );
  }

  async lock(agencyId: string, clipId: string): Promise<VideoClip | null> {
    const result = await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { agencyId: agencyId.trim(), clipId: clipId.trim() },
        UpdateExpression: "SET locked = :true REMOVE #ttl",
        ConditionExpression: "agencyId = :agencyId",
        ExpressionAttributeNames: { "#ttl": "ttl" },
        ExpressionAttributeValues: { ":true": true, ":agencyId": agencyId.trim() },
        ReturnValues: "ALL_NEW",
      }),
    );
    return (result.Attributes as VideoClip | undefined) ?? null;
  }

  async delete(agencyId: string, clipId: string): Promise<"ok" | "locked" | "missing"> {
    try {
      await ddb.send(
        new DeleteCommand({
          TableName: tableName(),
          Key: { agencyId: agencyId.trim(), clipId: clipId.trim() },
          ConditionExpression: "agencyId = :agencyId AND locked <> :true",
          ExpressionAttributeValues: { ":agencyId": agencyId.trim(), ":true": true },
        }),
      );
      return "ok";
    } catch (error) {
      const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
      if (name === "ConditionalCheckFailedException") {
        const existing = await this.get(agencyId, clipId);
        if (!existing) return "missing";
        if (existing.locked) return "locked";
        return "missing";
      }
      throw error;
    }
  }
}
