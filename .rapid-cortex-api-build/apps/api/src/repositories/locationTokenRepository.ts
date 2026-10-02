import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { LocationTokenRecord, LocationTokenStatus } from "rapid-cortex-shared";
import { env } from "../lib/env.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function tableName(): string {
  const t = env.locationTokensTable?.trim();
  if (!t) throw new Error("LOCATION_TOKENS_TABLE_NOT_CONFIGURED");
  return t;
}

export class LocationTokenRepository {
  async put(record: LocationTokenRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: tableName(),
        Item: record,
      }),
    );
  }

  async getByToken(token: string): Promise<LocationTokenRecord | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: tableName(),
        Key: { token },
      }),
    );
    return (result.Item as LocationTokenRecord) ?? null;
  }

  async listByIncident(incidentId: string, limit = 10): Promise<LocationTokenRecord[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        IndexName: "incidentId-index",
        KeyConditionExpression: "incidentId = :iid",
        ExpressionAttributeValues: { ":iid": incidentId },
        Limit: limit,
        ScanIndexForward: false,
      }),
    );
    return (result.Items as LocationTokenRecord[]) ?? [];
  }

  async markReceived(
    token: string,
    update: Pick<
      LocationTokenRecord,
      "status" | "source" | "coordinates" | "locationText" | "receivedAt"
    >,
  ): Promise<LocationTokenRecord | null> {
    const result = await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { token },
        UpdateExpression:
          "SET #st = :status, #src = :source, receivedAt = :receivedAt, coordinates = :coords, locationText = :text",
        ConditionExpression: "#st = :pending",
        ExpressionAttributeNames: { "#st": "status", "#src": "source" },
        ExpressionAttributeValues: {
          ":status": update.status,
          ":source": update.source,
          ":receivedAt": update.receivedAt,
          ":coords": update.coordinates ?? null,
          ":text": update.locationText ?? null,
          ":pending": "PENDING" satisfies LocationTokenStatus,
        },
        ReturnValues: "ALL_NEW",
      }),
    );
    return (result.Attributes as LocationTokenRecord) ?? null;
  }
}
