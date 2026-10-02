import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { VenueCamera } from "rapid-cortex-shared";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function tableName(): string {
  const t = process.env.CAMPUS_CAMERA_REGISTRY_TABLE?.trim();
  if (!t) throw new Error("CAMPUS_CAMERA_REGISTRY_TABLE not set");
  return t;
}

export class CampusCameraRegistryRepository {
  async listByAgency(agencyId: string): Promise<VenueCamera[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: "agencyId = :agencyId",
        ExpressionAttributeValues: { ":agencyId": agencyId.trim() },
      }),
    );
    return (result.Items ?? []) as VenueCamera[];
  }

  async get(agencyId: string, cameraId: string): Promise<VenueCamera | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: tableName(),
        Key: { agencyId: agencyId.trim(), cameraId: cameraId.trim() },
      }),
    );
    return (result.Item as VenueCamera | undefined) ?? null;
  }

  async put(camera: VenueCamera): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: tableName(),
        Item: camera,
      }),
    );
  }

  async delete(agencyId: string, cameraId: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: tableName(),
        Key: { agencyId: agencyId.trim(), cameraId: cameraId.trim() },
      }),
    );
  }

  async updateStatus(
    agencyId: string,
    cameraId: string,
    status: VenueCamera["status"],
    lastHeartbeat: string,
  ): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: tableName(),
        Key: { agencyId: agencyId.trim(), cameraId: cameraId.trim() },
        UpdateExpression: "SET #st = :status, lastHeartbeat = :hb",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: { ":status": status, ":hb": lastHeartbeat },
      }),
    );
  }

  async listAll(): Promise<VenueCamera[]> {
    const items: VenueCamera[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const result = await ddb.send(
        new ScanCommand({
          TableName: tableName(),
          ExclusiveStartKey: lastKey,
          Limit: 100,
        }),
      );
      items.push(...((result.Items ?? []) as VenueCamera[]));
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);
    return items;
  }
}
