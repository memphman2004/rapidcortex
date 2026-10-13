import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { createHash, randomBytes } from "node:crypto";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

export type OAuthAuthCode = {
  code: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  scope: string;
  subject: string;
  role: string;
  email?: string;
  expiresAt: number;
};

export type OAuthRefreshToken = {
  tokenHash: string;
  clientId: string;
  subject: string;
  role: string;
  email?: string;
  scope: string;
  expiresAt: number;
};

function pk(kind: string, id: string): string {
  return `${kind}#${id}`;
}

export async function putAuthCode(table: string, record: OAuthAuthCode): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: table,
      Item: {
        pk: pk("CODE", record.code),
        sk: "META",
        ...record,
        ttl: Math.floor(record.expiresAt / 1000),
      },
    }),
  );
}

export async function consumeAuthCode(
  table: string,
  code: string,
): Promise<OAuthAuthCode | null> {
  const res = await ddb.send(
    new GetCommand({
      TableName: table,
      Key: { pk: pk("CODE", code), sk: "META" },
    }),
  );
  if (!res.Item) return null;
  await ddb.send(
    new DeleteCommand({
      TableName: table,
      Key: { pk: pk("CODE", code), sk: "META" },
    }),
  );
  const item = res.Item as OAuthAuthCode;
  if (item.expiresAt < Date.now()) return null;
  return item;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function putRefreshToken(table: string, record: OAuthRefreshToken): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: table,
      Item: {
        pk: pk("REFRESH", record.tokenHash),
        sk: "META",
        ...record,
        ttl: Math.floor(record.expiresAt / 1000),
      },
    }),
  );
}

export async function getRefreshToken(
  table: string,
  token: string,
): Promise<OAuthRefreshToken | null> {
  const tokenHash = hashToken(token);
  const res = await ddb.send(
    new GetCommand({
      TableName: table,
      Key: { pk: pk("REFRESH", tokenHash), sk: "META" },
    }),
  );
  if (!res.Item) return null;
  const item = res.Item as OAuthRefreshToken;
  if (item.expiresAt < Date.now()) return null;
  return item;
}

export async function deleteRefreshToken(table: string, token: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: table,
      Key: { pk: pk("REFRESH", hashToken(token)), sk: "META" },
    }),
  );
}

/** Sliding-window hourly rate limit keyed by subject. */
export async function checkAndIncrementRateLimit(
  table: string,
  subject: string,
  limit: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const windowId = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const key = pk("RL", `${subject}#${windowId}`);
  try {
    const res = await ddb.send(
      new UpdateCommand({
        TableName: table,
        Key: { pk: key, sk: "META" },
        UpdateExpression: "ADD #c :one SET #ttl = if_not_exists(#ttl, :ttl)",
        ExpressionAttributeNames: { "#c": "count", "#ttl": "ttl" },
        ExpressionAttributeValues: {
          ":one": 1,
          ":ttl": Math.floor(Date.now() / 1000) + 7200,
          ":limit": limit,
        },
        ConditionExpression: "attribute_not_exists(#c) OR #c < :limit",
        ReturnValues: "ALL_NEW",
      }),
    );
    const count = Number(res.Attributes?.count ?? 1);
    return { allowed: true, remaining: Math.max(0, limit - count) };
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === "ConditionalCheckFailedException") {
      return { allowed: false, remaining: 0 };
    }
    throw err;
  }
}

export function newOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function newAuthCode(): string {
  return randomBytes(24).toString("base64url");
}
