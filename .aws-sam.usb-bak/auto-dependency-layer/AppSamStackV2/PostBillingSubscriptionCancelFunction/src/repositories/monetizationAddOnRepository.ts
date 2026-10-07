import { GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { defaultAddOnSeed } from "rapid-cortex-shared";
import type { MonetizationAddOnRecord } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

export class MonetizationAddOnRepository {
  async get(addOnId: string): Promise<MonetizationAddOnRecord | null> {
    const t = env.monetizationAddOnsTable;
    const now = new Date().toISOString();
    const seed = defaultAddOnSeed(now)[addOnId as keyof ReturnType<typeof defaultAddOnSeed>];
    if (!t) return seed ?? null;
    const res = await ddb.send(
      new GetCommand({ TableName: t, Key: { addOnId } }),
    );
    const row = res.Item as MonetizationAddOnRecord | undefined;
    if (row) return row;
    return seed ?? null;
  }

  async scanAll(limit = 200): Promise<MonetizationAddOnRecord[]> {
    const t = env.monetizationAddOnsTable;
    const now = new Date().toISOString();
    const seedMap = defaultAddOnSeed(now);
    if (!t) return Object.values(seedMap);
    const res = await ddb.send(new ScanCommand({ TableName: t, Limit: limit }));
    const items = ((res.Items as MonetizationAddOnRecord[]) ?? []).filter(Boolean);
    if (items.length > 0) return items;
    return Object.values(seedMap);
  }
}
