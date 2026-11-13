/**
 * Campus Blue-Light Connect — Pole Registry (DynamoDB).
 * Campus vertical only.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { BlueLightPole } from "rapid-cortex-shared";
import { SEED_POLES, findPoleById, findPoleBySipExtension } from "./seed-data.js";

const TABLE_NAME = process.env.CAMPUS_BLUELIGHT_POLES_TABLE ?? "blue-light-poles";
const USE_SEED = process.env.BLUELIGHT_USE_SEED === "true";

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" }),
);

export class BlueLightRegistry {
  /**
   * Resolve a pole by explicit poleId.
   * Falls back to seed data when USE_SEED=true (dev/demo).
   * Always enforces campusId — returns null if pole belongs to different campus.
   */
  async getPoleById(poleId: string, campusId?: string): Promise<BlueLightPole | null> {
    if (USE_SEED) {
      const pole = findPoleById(poleId) ?? null;
      if (!pole) return null;
      if (campusId && pole.campusId !== campusId) return null;
      return pole;
    }

    const result = await dynamo.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { poleId } }),
    );
    const pole = (result.Item as BlueLightPole | undefined) ?? null;
    if (!pole) return null;
    if (campusId && pole.campusId !== campusId) return null;
    return pole;
  }

  /**
   * Resolve a pole by SIP extension — used in the SIP call ingest path.
   * campusId scoping is applied when provided.
   */
  async getPoleBySipExtension(
    extension: string,
    campusId?: string,
  ): Promise<BlueLightPole | null> {
    if (USE_SEED) {
      const pole = findPoleBySipExtension(extension) ?? null;
      if (!pole) return null;
      if (campusId && pole.campusId !== campusId) return null;
      return pole;
    }

    const result = await dynamo.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "sipExtension-index",
        KeyConditionExpression: "sipExtension = :ext",
        ExpressionAttributeValues: { ":ext": extension },
        Limit: 1,
      }),
    );
    const pole = (result.Items?.[0] as BlueLightPole | undefined) ?? null;
    if (!pole) return null;
    if (campusId && pole.campusId !== campusId) return null;
    return pole;
  }

  /**
   * List all poles for a campus. Always scoped by campusId.
   */
  async getPolesByCampus(campusId: string): Promise<BlueLightPole[]> {
    if (USE_SEED) return SEED_POLES.filter((p) => p.campusId === campusId);

    const result = await dynamo.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "campusId-index",
        KeyConditionExpression: "campusId = :cid",
        ExpressionAttributeValues: { ":cid": campusId },
      }),
    );
    return (result.Items as BlueLightPole[]) ?? [];
  }

  /**
   * Register a new pole (admin only; enforced at handler level).
   */
  async registerPole(pole: BlueLightPole): Promise<void> {
    await dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: pole,
        ConditionExpression: "attribute_not_exists(poleId)",
      }),
    );
  }

  /**
   * Update pole status (e.g. mark offline on hardware failure).
   */
  async updatePoleStatus(poleId: string, status: BlueLightPole["status"]): Promise<void> {
    await dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { poleId },
        UpdateExpression: "SET #s = :s, updatedAt = :ts",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":s": status, ":ts": new Date().toISOString() },
      }),
    );
  }

  /** Seed demo poles into DynamoDB (dev only). */
  async seedDemoData(): Promise<void> {
    for (const pole of SEED_POLES) {
      await dynamo.send(new PutCommand({ TableName: TABLE_NAME, Item: pole }));
    }
    console.log(
      JSON.stringify({
        msg: "bluelight_seed_complete",
        count: SEED_POLES.length,
        table: TABLE_NAME,
      }),
    );
  }
}
