import {
  DynamoDBClient,
  type DynamoDBClientConfig,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  HIRING_BOOKINGS_SETTING_KEY,
  type HiringBookingsConfig,
} from "rapid-cortex-shared";
import { env } from "../lib/env.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({} as DynamoDBClientConfig), {
  marshallOptions: { removeUndefinedValues: true },
});

export class PlatformSettingsRepository {
  private table(): string {
    const t = env.platformSettingsTable;
    if (!t) throw new Error("PLATFORM_SETTINGS_TABLE is not configured");
    return t;
  }

  async getHiringBookings(): Promise<HiringBookingsConfig> {
    const { Item } = await ddb.send(
      new GetCommand({
        TableName: this.table(),
        Key: { settingKey: HIRING_BOOKINGS_SETTING_KEY },
      }),
    );
    const value = Item?.value;
    if (value && typeof value === "object") return value as HiringBookingsConfig;
    return {};
  }

  async putHiringBookings(value: HiringBookingsConfig): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: {
          settingKey: HIRING_BOOKINGS_SETTING_KEY,
          agencyId: "platform",
          value,
          updatedAt: new Date().toISOString(),
        },
      }),
    );
  }
}
