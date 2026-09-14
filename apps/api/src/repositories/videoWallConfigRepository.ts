import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { VideoWallConfig } from "rapid-cortex-shared";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function tableName(): string {
  const t = process.env.VIDEO_WALL_CONFIGS_TABLE?.trim();
  if (!t) throw new Error("VIDEO_WALL_CONFIGS_TABLE not set");
  return t;
}

export class VideoWallConfigRepository {
  async get(agencyId: string, userId: string): Promise<VideoWallConfig | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: tableName(),
        Key: { agencyId: agencyId.trim(), userId: userId.trim() },
      }),
    );
    return (result.Item as VideoWallConfig | undefined) ?? null;
  }

  async put(config: VideoWallConfig): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: tableName(),
        Item: config,
      }),
    );
  }
}
