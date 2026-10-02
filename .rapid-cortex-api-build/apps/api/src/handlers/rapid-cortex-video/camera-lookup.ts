import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { VenueCamera, VideoCameraRetentionPolicy } from "rapid-cortex-shared";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function registryTables(): string[] {
  return [
    process.env.VENUE_CAMERA_REGISTRY_TABLE?.trim(),
    process.env.CAMPUS_CAMERA_REGISTRY_TABLE?.trim(),
    process.env.TRANSIT_CAMERA_REGISTRY_TABLE?.trim(),
  ].filter((t): t is string => Boolean(t));
}

export async function getAgencyCamera(agencyId: string, cameraId: string): Promise<VenueCamera | null> {
  const aid = agencyId.trim();
  const cid = cameraId.trim();
  for (const TableName of registryTables()) {
    try {
      const result = await ddb.send(
        new GetCommand({
          TableName,
          Key: { agencyId: aid, cameraId: cid },
        }),
      );
      const item = result.Item as VenueCamera | undefined;
      if (item?.agencyId === aid && item.cameraId === cid) return item;
    } catch (error) {
      console.warn("[rapid-cortex-video] camera lookup skipped", TableName, error);
    }
  }
  return null;
}

export async function updateCameraRecording(
  agencyId: string,
  cameraId: string,
  fields: {
    retentionPolicy: VideoCameraRetentionPolicy;
    kvsStreamName?: string;
    kvsStreamArn?: string;
  },
): Promise<VenueCamera | null> {
  const existing = await getAgencyCamera(agencyId, cameraId);
  if (!existing) return null;
  const aid = agencyId.trim();
  const cid = cameraId.trim();
  const values: Record<string, unknown> = {
    ":policy": fields.retentionPolicy,
    ":agencyId": aid,
  };
  const sets = ["retentionPolicy = :policy"];
  if (fields.kvsStreamName) {
    sets.push("kvsStreamName = :kvsStreamName");
    values[":kvsStreamName"] = fields.kvsStreamName;
  }
  if (fields.kvsStreamArn) {
    sets.push("kvsStreamArn = :kvsStreamArn");
    values[":kvsStreamArn"] = fields.kvsStreamArn;
  }
  for (const TableName of registryTables()) {
    try {
      const result = await ddb.send(
        new UpdateCommand({
          TableName,
          Key: { agencyId: aid, cameraId: cid },
          UpdateExpression: `SET ${sets.join(", ")}`,
          ConditionExpression: "agencyId = :agencyId",
          ExpressionAttributeValues: values,
          ReturnValues: "ALL_NEW",
        }),
      );
      const item = result.Attributes as VenueCamera | undefined;
      if (item?.agencyId === aid) return item;
    } catch (error) {
      const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
      if (name === "ConditionalCheckFailedException") continue;
      console.warn("[rapid-cortex-video] camera recording update skipped", TableName, error);
    }
  }
  return existing;
}

export async function updateCameraPtzPresets(
  agencyId: string,
  cameraId: string,
  ptzPresets: Array<{ token: string; name: string }>,
): Promise<VenueCamera | null> {
  const existing = await getAgencyCamera(agencyId, cameraId);
  if (!existing) return null;
  const aid = agencyId.trim();
  const cid = cameraId.trim();
  for (const TableName of registryTables()) {
    try {
      const result = await ddb.send(
        new UpdateCommand({
          TableName,
          Key: { agencyId: aid, cameraId: cid },
          UpdateExpression: "SET ptzPresets = :presets",
          ConditionExpression: "agencyId = :agencyId",
          ExpressionAttributeValues: { ":presets": ptzPresets, ":agencyId": aid },
          ReturnValues: "ALL_NEW",
        }),
      );
      const item = result.Attributes as VenueCamera | undefined;
      if (item?.agencyId === aid) return item;
    } catch (error) {
      const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
      if (name === "ConditionalCheckFailedException") continue;
      console.warn("[rapid-cortex-video] camera PTZ preset update skipped", TableName, error);
    }
  }
  return existing;
}
