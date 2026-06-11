import {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { QRNFCRecord, ReportVertical } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

function tableName(): string {
  const name = env.qrNfcCodesTable?.trim();
  if (!name) throw new Error("QR_NFC_CODES_TABLE is not configured");
  return name;
}

export type QRNFCListItem = Omit<QRNFCRecord, "qrImageBase64">;

function stripImage(record: QRNFCRecord): QRNFCListItem {
  const { qrImageBase64: _img, ...rest } = record;
  return rest;
}

export class QrNfcRepository {
  async get(agencyId: string, qrId: string): Promise<QRNFCRecord | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: tableName(),
        Key: { agencyId, qrId },
      }),
    );
    return (out.Item as QRNFCRecord | undefined) ?? null;
  }

  async getByQrId(qrId: string): Promise<QRNFCRecord | null> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        IndexName: "qrId-index",
        KeyConditionExpression: "qrId = :qrId",
        ExpressionAttributeValues: { ":qrId": qrId },
        Limit: 1,
      }),
    );
    const item = out.Items?.[0] as QRNFCRecord | undefined;
    return item ?? null;
  }

  async put(record: QRNFCRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: tableName(),
        Item: record,
        ConditionExpression: "attribute_not_exists(qrId)",
      }),
    );
  }

  async update(agencyId: string, qrId: string, patch: Partial<QRNFCRecord>): Promise<QRNFCRecord | null> {
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    const sets: string[] = [];
    for (const [key, value] of Object.entries(patch)) {
      if (key === "qrId" || key === "agencyId" || key === "createdAt" || key === "createdBy") continue;
      if (value === undefined) continue;
      const nk = `#${key}`;
      const vk = `:${key}`;
      names[nk] = key;
      values[vk] = value;
      sets.push(`${nk} = ${vk}`);
    }
    if (sets.length === 0) return this.get(agencyId, qrId);
    values[":updatedAt"] = new Date().toISOString();
    names["#updatedAt"] = "updatedAt";
    sets.push("#updatedAt = :updatedAt");
    const out = await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { agencyId, qrId },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW",
      }),
    );
    return (out.Attributes as QRNFCRecord | undefined) ?? null;
  }

  async listByAgency(
    agencyId: string,
    opts?: { vertical?: ReportVertical; active?: boolean; limit?: number },
  ): Promise<QRNFCListItem[]> {
    const values: Record<string, unknown> = { ":agencyId": agencyId };
    let keyExpr = "agencyId = :agencyId";
    let indexName: string | undefined;
    if (opts?.vertical) {
      indexName = "agencyId-vertical-index";
      keyExpr = "agencyId = :agencyId AND vertical = :vertical";
      values[":vertical"] = opts.vertical;
    }
    const filter: string[] = [];
    if (opts?.active !== undefined) {
      filter.push("active = :active");
      values[":active"] = opts.active;
    }
    const out = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        ...(indexName ? { IndexName: indexName } : {}),
        KeyConditionExpression: keyExpr,
        ...(filter.length
          ? {
              FilterExpression: filter.join(" AND "),
            }
          : {}),
        ExpressionAttributeValues: values,
        Limit: opts?.limit ?? 200,
      }),
    );
    return ((out.Items ?? []) as QRNFCRecord[]).map(stripImage);
  }

  async listGlobal(opts?: {
    agencyId?: string;
    vertical?: ReportVertical;
    active?: boolean;
    limit?: number;
  }): Promise<QRNFCListItem[]> {
    const filter: string[] = [];
    const values: Record<string, unknown> = {};
    if (opts?.agencyId) {
      filter.push("agencyId = :agencyId");
      values[":agencyId"] = opts.agencyId;
    }
    if (opts?.vertical) {
      filter.push("vertical = :vertical");
      values[":vertical"] = opts.vertical;
    }
    if (opts?.active !== undefined) {
      filter.push("active = :active");
      values[":active"] = opts.active;
    }
    const out = await ddb.send(
      new ScanCommand({
        TableName: tableName(),
        ...(filter.length
          ? {
              FilterExpression: filter.join(" AND "),
              ExpressionAttributeValues: values,
            }
          : {}),
        Limit: opts?.limit ?? 500,
      }),
    );
    return ((out.Items ?? []) as QRNFCRecord[]).map(stripImage);
  }

  async incrementEngagement(
    agencyId: string,
    qrId: string,
    medium: "qr" | "nfc" | "direct" | "url",
  ): Promise<void> {
    const field = medium === "nfc" ? "nfcTapCount" : "scanCount";
    const now = new Date().toISOString();
    await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { agencyId, qrId },
        UpdateExpression: `SET ${field} = if_not_exists(${field}, :zero) + :one, totalEngagements = if_not_exists(totalEngagements, :zero) + :one, lastEngagementAt = :now, updatedAt = :now`,
        ExpressionAttributeValues: { ":one": 1, ":zero": 0, ":now": now },
      }),
    );
  }
}
