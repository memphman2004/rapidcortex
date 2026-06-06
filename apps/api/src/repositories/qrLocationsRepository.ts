import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { QRLocation, QRLocationVertical } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

function tableName(): string {
  const name = env.qrLocationsTable?.trim();
  if (!name) throw new Error("QR_LOCATIONS_TABLE is not configured");
  return name;
}

export class QRLocationsRepository {
  async getByRcli(rcli: string): Promise<QRLocation | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: tableName(),
        Key: { rcli },
      }),
    );
    return (out.Item as QRLocation | undefined) ?? null;
  }

  async put(location: QRLocation): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: tableName(),
        Item: location,
        ConditionExpression: "attribute_not_exists(rcli)",
      }),
    );
  }

  async update(rcli: string, patch: Partial<QRLocation>): Promise<QRLocation | null> {
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    const sets: string[] = [];
    for (const [key, value] of Object.entries(patch)) {
      if (key === "rcli" || key === "agencyId" || key === "createdAt" || key === "createdBy") continue;
      if (value === undefined) continue;
      const nk = `#${key}`;
      const vk = `:${key}`;
      names[nk] = key;
      values[vk] = value;
      sets.push(`${nk} = ${vk}`);
    }
    if (sets.length === 0) return this.getByRcli(rcli);
    values[":updatedAt"] = new Date().toISOString();
    names["#updatedAt"] = "updatedAt";
    sets.push("#updatedAt = :updatedAt");
    const out = await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { rcli },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW",
      }),
    );
    return (out.Attributes as QRLocation | undefined) ?? null;
  }

  async listByAgency(
    agencyId: string,
    opts?: { vertical?: QRLocationVertical; active?: boolean; limit?: number },
  ): Promise<QRLocation[]> {
    const filter: string[] = [];
    const values: Record<string, unknown> = { ":agencyId": agencyId };
    if (opts?.vertical) {
      filter.push("vertical = :vertical");
      values[":vertical"] = opts.vertical;
    }
    if (opts?.active !== undefined) {
      filter.push("active = :active");
      values[":active"] = opts.active;
    }
    const out = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        IndexName: "agencyId-createdAt-index",
        KeyConditionExpression: "agencyId = :agencyId",
        FilterExpression: filter.length ? filter.join(" AND ") : undefined,
        ExpressionAttributeValues: values,
        ScanIndexForward: false,
        Limit: opts?.limit ?? 500,
      }),
    );
    return (out.Items ?? []) as QRLocation[];
  }

  async listByVertical(
    vertical: QRLocationVertical,
    opts?: { limit?: number },
  ): Promise<QRLocation[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        IndexName: "vertical-createdAt-index",
        KeyConditionExpression: "vertical = :vertical",
        ExpressionAttributeValues: { ":vertical": vertical },
        ScanIndexForward: false,
        Limit: opts?.limit ?? 500,
      }),
    );
    return (out.Items ?? []) as QRLocation[];
  }

  async recordScan(rcli: string): Promise<void> {
    const now = new Date().toISOString();
    await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { rcli },
        UpdateExpression: "SET scanCount = if_not_exists(scanCount, :zero) + :one, lastScannedAt = :now",
        ExpressionAttributeValues: {
          ":zero": 0,
          ":one": 1,
          ":now": now,
        },
      }),
    );
  }
}
