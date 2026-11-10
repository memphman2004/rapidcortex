import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { CallerLocationEntry, PostCallerLocationBody } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

const TTL_SECONDS = 90 * 24 * 60 * 60;

export class CallerLocationsRepository {
  private table(): string {
    const t = env.callerLocationsTable?.trim();
    if (!t) throw new Error("CALLER_LOCATIONS_DISABLED");
    return t;
  }

  async put(params: {
    incidentId: string;
    agencyId: string;
    body: PostCallerLocationBody;
  }): Promise<CallerLocationEntry> {
    const timestamp = params.body.timestamp;
    const ttl = Math.floor(new Date(timestamp).getTime() / 1000) + TTL_SECONDS;
    const item = {
      incidentId: params.incidentId,
      timestamp,
      agencyId: params.agencyId,
      lat: params.body.lat,
      lng: params.body.lng,
      accuracy: params.body.accuracy,
      heading: params.body.heading,
      speed: params.body.speed,
      source: params.body.source,
      ttl,
    };
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: item,
        ConditionExpression: "attribute_not_exists(incidentId) OR agencyId = :agencyId",
        ExpressionAttributeValues: { ":agencyId": params.agencyId },
      }),
    );
    return {
      incidentId: item.incidentId,
      agencyId: item.agencyId,
      lat: item.lat,
      lng: item.lng,
      accuracy: item.accuracy,
      heading: item.heading,
      speed: item.speed,
      source: item.source,
      timestamp: item.timestamp,
      ttl: item.ttl,
    };
  }

  async listRecent(incidentId: string, agencyId: string, limit = 100): Promise<CallerLocationEntry[]> {
    const res = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        KeyConditionExpression: "incidentId = :incidentId",
        ExpressionAttributeValues: { ":incidentId": incidentId, ":agencyId": agencyId },
        FilterExpression: "agencyId = :agencyId",
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (res.Items ?? []).map((row) => ({
      incidentId: String(row.incidentId),
      agencyId: String(row.agencyId),
      lat: Number(row.lat),
      lng: Number(row.lng),
      accuracy: Number(row.accuracy),
      heading: typeof row.heading === "number" ? row.heading : undefined,
      speed: typeof row.speed === "number" ? row.speed : undefined,
      source: row.source as CallerLocationEntry["source"],
      timestamp: String(row.timestamp),
      ttl: typeof row.ttl === "number" ? row.ttl : undefined,
    }));
  }
}
