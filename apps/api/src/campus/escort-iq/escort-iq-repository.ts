import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { EscortSessionStaff } from "rapid-cortex-shared";
import { ESCORT_IQ_KEYS } from "./escort-iq-keys.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export type EscortSessionDdbItem = EscortSessionStaff & {
  pk: string;
  sk: string;
  entityType: "ESCORT_SESSION";
  publicTokenHash: string;
  updatedAt: string;
  ttl?: number;
};

export type EscortTokenDdbItem = {
  pk: string;
  sk: string;
  entityType: "ESCORT_TOKEN";
  agencyId: string;
  campusCode: string;
  escortId: string;
  ttl?: number;
};

function tableName(): string {
  const t = process.env.CAMPUS_INCIDENTS_TABLE?.trim();
  if (!t) throw new Error("CAMPUS_INCIDENTS_TABLE not set");
  return t;
}

export class EscortIqRepository {
  async putSession(item: EscortSessionDdbItem): Promise<void> {
    await ddb.send(new PutCommand({ TableName: tableName(), Item: item }));
  }

  async putToken(item: EscortTokenDdbItem): Promise<void> {
    await ddb.send(new PutCommand({ TableName: tableName(), Item: item }));
  }

  async getSession(campusCode: string, escortId: string): Promise<EscortSessionDdbItem | null> {
    const r = await ddb.send(
      new GetCommand({
        TableName: tableName(),
        Key: {
          pk: ESCORT_IQ_KEYS.pk(campusCode),
          sk: ESCORT_IQ_KEYS.sessionSk(escortId),
        },
      }),
    );
    return (r.Item as EscortSessionDdbItem | undefined) ?? null;
  }

  async getByTokenHash(tokenHash: string): Promise<EscortTokenDdbItem | null> {
    const r = await ddb.send(
      new GetCommand({
        TableName: tableName(),
        Key: {
          pk: ESCORT_IQ_KEYS.tokenPk(tokenHash),
          sk: ESCORT_IQ_KEYS.tokenSk(),
        },
      }),
    );
    return (r.Item as EscortTokenDdbItem | undefined) ?? null;
  }

  async listByCampus(campusCode: string, limit = 50): Promise<EscortSessionDdbItem[]> {
    const r = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": ESCORT_IQ_KEYS.pk(campusCode),
          ":sk": "ESCORT#",
        },
        ScanIndexForward: false,
        Limit: Math.min(limit, 100),
      }),
    );
    return ((r.Items as EscortSessionDdbItem[]) ?? []).filter((i) => i.entityType === "ESCORT_SESSION");
  }

  async updateSession(
    campusCode: string,
    escortId: string,
    updates: Record<string, unknown>,
  ): Promise<EscortSessionDdbItem> {
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    const sets: string[] = [];
    let i = 0;
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined) continue;
      const nk = `#k${i}`;
      const nv = `:v${i}`;
      names[nk] = k;
      values[nv] = v;
      sets.push(`${nk} = ${nv}`);
      i += 1;
    }
    names["#updatedAt"] = "updatedAt";
    values[":updatedAt"] = new Date().toISOString();
    sets.push("#updatedAt = :updatedAt");

    const r = await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: {
          pk: ESCORT_IQ_KEYS.pk(campusCode),
          sk: ESCORT_IQ_KEYS.sessionSk(escortId),
        },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ConditionExpression: "attribute_exists(pk)",
        ReturnValues: "ALL_NEW",
      }),
    );
    return r.Attributes as EscortSessionDdbItem;
  }
}
