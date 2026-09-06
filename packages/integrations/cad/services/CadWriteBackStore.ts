import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { CadWriteBackRequest, CadWriteBackStatus } from "rapid-cortex-shared";
import { cadConnectorTableNames } from "../env.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

const NINETY_DAYS_S = 90 * 24 * 60 * 60;

function writebacksTable(): string {
  const name = cadConnectorTableNames().writebacks;
  if (!name) throw new Error("CAD_CONNECTOR_WRITEBACKS_TABLE is not set");
  return name;
}

export class CadWriteBackStore {
  async put(row: CadWriteBackRequest): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: writebacksTable(),
        Item: {
          ...row,
          ttlEpoch: Math.floor(Date.now() / 1000) + NINETY_DAYS_S,
        },
        ConditionExpression: "attribute_not_exists(agencyId) OR agencyId = :agencyId",
        ExpressionAttributeValues: { ":agencyId": row.agencyId },
      }),
    );
  }

  async get(agencyId: string, writeBackId: string): Promise<CadWriteBackRequest | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: writebacksTable(),
        Key: { agencyId: agencyId.trim(), writeBackId: writeBackId.trim() },
      }),
    );
    const item = result.Item as CadWriteBackRequest | undefined;
    if (!item || item.agencyId !== agencyId.trim()) return null;
    return item;
  }

  async list(params: {
    agencyId: string;
    status?: CadWriteBackStatus;
    unifiedId?: string;
    limit: number;
  }): Promise<CadWriteBackRequest[]> {
    if (params.unifiedId) {
      const result = await ddb.send(
        new QueryCommand({
          TableName: writebacksTable(),
          IndexName: "agencyId-unifiedId-index",
          KeyConditionExpression: "agencyId = :agencyId AND unifiedId = :unifiedId",
          ExpressionAttributeValues: {
            ":agencyId": params.agencyId.trim(),
            ":unifiedId": params.unifiedId,
          },
          ScanIndexForward: false,
          Limit: params.limit,
        }),
      );
      return ((result.Items ?? []) as CadWriteBackRequest[]).filter((row) => row.agencyId === params.agencyId.trim());
    }
    if (params.status) {
      const result = await ddb.send(
        new QueryCommand({
          TableName: writebacksTable(),
          IndexName: "agencyId-status-index",
          KeyConditionExpression: "agencyId = :agencyId AND #st = :status",
          ExpressionAttributeNames: { "#st": "status" },
          ExpressionAttributeValues: {
            ":agencyId": params.agencyId.trim(),
            ":status": params.status,
          },
          ScanIndexForward: false,
          Limit: params.limit,
        }),
      );
      return ((result.Items ?? []) as CadWriteBackRequest[]).filter((row) => row.agencyId === params.agencyId.trim());
    }
    const result = await ddb.send(
      new QueryCommand({
        TableName: writebacksTable(),
        KeyConditionExpression: "agencyId = :agencyId",
        ExpressionAttributeValues: { ":agencyId": params.agencyId.trim() },
        ScanIndexForward: false,
        Limit: params.limit,
      }),
    );
    return ((result.Items ?? []) as CadWriteBackRequest[]).filter((row) => row.agencyId === params.agencyId.trim());
  }
}

export function newWriteBackId(): string {
  return `cwb_${randomUUID()}`;
}

export const cadWriteBackStore = new CadWriteBackStore();
