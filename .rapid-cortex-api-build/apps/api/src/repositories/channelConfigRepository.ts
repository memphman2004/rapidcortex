import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { ChannelConfig } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

export class ChannelConfigRepository {
  private table(): string {
    const t = env.channelConfigTable?.trim();
    if (!t) throw new Error("CHANNEL_CONFIG_UNAVAILABLE");
    return t;
  }

  async listByAgency(agencyId: string): Promise<ChannelConfig[]> {
    const res = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        KeyConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":a": agencyId },
      }),
    );
    return (res.Items ?? []) as ChannelConfig[];
  }

  async get(agencyId: string, channelId: string): Promise<ChannelConfig | null> {
    const res = await ddb.send(
      new GetCommand({
        TableName: this.table(),
        Key: { agencyId, channelId },
      }),
    );
    const row = res.Item as ChannelConfig | undefined;
    if (!row || row.agencyId !== agencyId) return null;
    return row;
  }

  async put(record: ChannelConfig): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: record,
      }),
    );
  }

  async patch(
    agencyId: string,
    channelId: string,
    updates: Partial<ChannelConfig> & { updatedAt: string },
  ): Promise<void> {
    const names: Record<string, string> = { "#u": "updatedAt" };
    const values: Record<string, unknown> = { ":u": updates.updatedAt };
    const sets: string[] = ["#u = :u"];

    for (const [key, val] of Object.entries(updates)) {
      if (key === "updatedAt" || key === "agencyId" || key === "channelId") continue;
      const nk = `#${key}`;
      const vk = `:${key}`;
      names[nk] = key;
      values[vk] = val;
      sets.push(`${nk} = ${vk}`);
    }

    await ddb.send(
      new UpdateCommand({
        TableName: this.table(),
        Key: { agencyId, channelId },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ConditionExpression: "attribute_exists(agencyId)",
      }),
    );
  }
}
