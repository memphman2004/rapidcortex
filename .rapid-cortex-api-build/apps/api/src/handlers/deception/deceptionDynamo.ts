import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { DeceptionEvent } from "./deceptionEvent.js";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

function tableName(): string {
  const t = process.env.DECEPTION_EVENTS_TABLE?.trim();
  if (!t) throw new Error("DECEPTION_EVENTS_TABLE_NOT_SET");
  return t;
}

export async function putDeceptionEvent(
  item: DeceptionEvent,
  opts?: { conditionExpression?: string },
): Promise<void> {
  await client.send(
    new PutCommand({
      TableName: tableName(),
      Item: item,
      ...(opts?.conditionExpression
        ? { ConditionExpression: opts.conditionExpression }
        : {}),
    }),
  );
}

export async function queryEventsBySourceIpSince(
  sourceIp: string,
  sinceIso: string,
  limit = 50,
): Promise<DeceptionEvent[]> {
  const res = await client.send(
    new QueryCommand({
      TableName: tableName(),
      IndexName: "sourceIp-createdAt-index",
      KeyConditionExpression: "sourceIp = :ip AND createdAt > :since",
      ExpressionAttributeValues: { ":ip": sourceIp, ":since": sinceIso },
      Limit: limit,
      ScanIndexForward: true,
    }),
  );
  return (res.Items ?? []) as DeceptionEvent[];
}

export async function countHoneytokenEventsByIpSince(sourceIp: string, sinceIso: string): Promise<number> {
  const items = await queryEventsBySourceIpSince(sourceIp, sinceIso, 80);
  return items.filter((e) => e.eventType === "HONEYTOKEN_USED").length;
}

export async function scanRecentDeceptionEvents(limit = 500): Promise<DeceptionEvent[]> {
  const res = await client.send(
    new ScanCommand({
      TableName: tableName(),
      Limit: limit,
    }),
  );
  const rows = (res.Items ?? []) as DeceptionEvent[];
  rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return rows;
}
