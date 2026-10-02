import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { SmsRoutingRecord } from "rapid-cortex-shared";
import { env } from "../lib/env.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function tableName(): string {
  const t = env.smsRoutingTable?.trim();
  if (!t) throw new Error("SMS_ROUTING_TABLE_NOT_CONFIGURED");
  return t;
}

export class SmsRoutingRepository {
  async getByPhone(phoneNumber: string): Promise<SmsRoutingRecord | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: tableName(),
        Key: { phoneNumber },
      }),
    );
    return (result.Item as SmsRoutingRecord) ?? null;
  }

  async listByAgency(agencyId: string): Promise<SmsRoutingRecord[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        IndexName: "agencyId-phoneNumber-index",
        KeyConditionExpression: "agencyId = :aid",
        ExpressionAttributeValues: { ":aid": agencyId },
        ScanIndexForward: true,
      }),
    );
    return (result.Items as SmsRoutingRecord[]) ?? [];
  }

  async put(record: SmsRoutingRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: tableName(),
        Item: record,
      }),
    );
  }

  async patch(
    phoneNumber: string,
    update: Partial<Pick<SmsRoutingRecord, "label" | "active" | "agencyName" | "updatedAt">>,
  ): Promise<SmsRoutingRecord | null> {
    const parts: string[] = ["updatedAt = :now"];
    const values: Record<string, unknown> = { ":now": update.updatedAt ?? new Date().toISOString() };
    const names: Record<string, string> = {};

    if (update.label !== undefined) {
      parts.push("#lbl = :lbl");
      values[":lbl"] = update.label;
      names["#lbl"] = "label";
    }
    if (update.active !== undefined) {
      parts.push("#act = :act");
      values[":act"] = update.active;
      names["#act"] = "active";
    }
    if (update.agencyName !== undefined) {
      parts.push("agencyName = :an");
      values[":an"] = update.agencyName;
    }

    const result = await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { phoneNumber },
        UpdateExpression: `SET ${parts.join(", ")}`,
        ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW",
      }),
    );
    return (result.Attributes as SmsRoutingRecord) ?? null;
  }
}
