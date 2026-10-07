import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { defaultPlanSeed } from "rapid-cortex-shared";
import type { MonetizationPlanRecord } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

export class MonetizationPlanRepository {
  async get(planId: string): Promise<MonetizationPlanRecord | null> {
    const pk = planId === "intelligence_api" ? "rc_lite" : planId;
    const t = env.monetizationPlansTable;
    const seed = defaultPlanSeed(new Date().toISOString());
    if (!t) return seed[pk] ?? null;
    const res = await ddb.send(
      new GetCommand({ TableName: t, Key: { planId: pk } }),
    );
    const row = res.Item as MonetizationPlanRecord | undefined;
    if (row) return row;
    /** Legacy Dynamo partition key `intelligence_api` */
    if (planId === "intelligence_api" || pk === "rc_lite") {
      const legacy = await ddb.send(
        new GetCommand({ TableName: t, Key: { planId: "intelligence_api" } }),
      );
      const old = legacy.Item as MonetizationPlanRecord | undefined;
      if (old) return old;
    }
    return seed[pk] ?? null;
  }

  async put(plan: MonetizationPlanRecord): Promise<void> {
    const t = env.monetizationPlansTable;
    if (!t) throw new Error("MONETIZATION_PLANS_TABLE not configured");
    await ddb.send(new PutCommand({ TableName: t, Item: plan }));
  }

  /**
   * Platform-wide pricing catalog (NOT agency-tenant data). Safe to scan for admin pricing UIs.
   * TODO(prod): cap page size + add read-only replication if catalog grows large.
   */
  async scanAll(limit = 200): Promise<MonetizationPlanRecord[]> {
    const t = env.monetizationPlansTable;
    const now = new Date().toISOString();
    const seed = defaultPlanSeed(now);
    if (!t) return Object.values(seed);
    const res = await ddb.send(new ScanCommand({ TableName: t, Limit: limit }));
    const items = ((res.Items as MonetizationPlanRecord[]) ?? []).filter(Boolean);
    if (items.length > 0) return items;
    return Object.values(seed);
  }
}
