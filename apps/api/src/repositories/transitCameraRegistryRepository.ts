import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { VenueCamera } from "rapid-cortex-shared";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function tableName(): string {
  const t = process.env.TRANSIT_CAMERA_REGISTRY_TABLE?.trim();
  if (!t) throw new Error("TRANSIT_CAMERA_REGISTRY_TABLE not set");
  return t;
}

export class TransitCameraRegistryRepository {
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
    const item = result.Item as VenueCamera | undefined;
    if (!item || item.agencyId !== agencyId.trim()) return null;
    return item;
  }

  async put(camera: VenueCamera): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: tableName(),
        Item: camera,
        ConditionExpression: "attribute_not_exists(agencyId) OR agencyId = :agencyId",
        ExpressionAttributeValues: { ":agencyId": camera.agencyId.trim() },
      }),
    );
  }

  async delete(agencyId: string, cameraId: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: tableName(),
        Key: { agencyId: agencyId.trim(), cameraId: cameraId.trim() },
        ConditionExpression: "agencyId = :agencyId",
        ExpressionAttributeValues: { ":agencyId": agencyId.trim() },
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
        ConditionExpression: "agencyId = :agencyId",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: {
          ":status": status,
          ":hb": lastHeartbeat,
          ":agencyId": agencyId.trim(),
        },
      }),
    );
  }
}
