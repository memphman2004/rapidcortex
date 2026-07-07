import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  GlobalPricingConfig,
  PricingAuditRecord,
  PricingChangeEntry,
  PricingOverrides,
  TenantPricingConfig,
} from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { ddb } from "./baseRepository.js";

const AUDIT_PK = "AUDIT";

export class PricingConfigRepository {
  async getGlobal(): Promise<GlobalPricingConfig | null> {
    if (!env.pricingConfigTable) return null;
    const res = await ddb.send(
      new GetCommand({
        TableName: env.pricingConfigTable,
        Key: { pk: "GLOBAL", sk: "v1" },
      }),
    );
    return (res.Item as GlobalPricingConfig | undefined) ?? null;
  }

  async putGlobal(config: GlobalPricingConfig): Promise<void> {
    if (!env.pricingConfigTable) throw new Error("PRICING_CONFIG_TABLE not configured");
    await ddb.send(
      new PutCommand({
        TableName: env.pricingConfigTable,
        Item: config,
      }),
    );
  }
}

export class TenantPricingRepository {
  async get(agencyId: string): Promise<TenantPricingConfig | null> {
    if (!env.tenantPricingOverridesTable) return null;
    const res = await ddb.send(
      new GetCommand({
        TableName: env.tenantPricingOverridesTable,
        Key: { pk: `AGENCY#${agencyId}`, sk: "PRICING" },
      }),
    );
    return (res.Item as TenantPricingConfig | undefined) ?? null;
  }

  async put(config: TenantPricingConfig): Promise<void> {
    if (!env.tenantPricingOverridesTable) {
      throw new Error("TENANT_PRICING_OVERRIDES_TABLE not configured");
    }
    await ddb.send(
      new PutCommand({
        TableName: env.tenantPricingOverridesTable,
        Item: config,
      }),
    );
  }

  async delete(agencyId: string): Promise<void> {
    if (!env.tenantPricingOverridesTable) {
      throw new Error("TENANT_PRICING_OVERRIDES_TABLE not configured");
    }
    await ddb.send(
      new DeleteCommand({
        TableName: env.tenantPricingOverridesTable,
        Key: { pk: `AGENCY#${agencyId}`, sk: "PRICING" },
      }),
    );
  }

  async listAll(): Promise<TenantPricingConfig[]> {
    if (!env.tenantPricingOverridesTable) return [];
    const items: TenantPricingConfig[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const res = await ddb.send(
        new ScanCommand({
          TableName: env.tenantPricingOverridesTable,
          FilterExpression: "sk = :sk",
          ExpressionAttributeValues: { ":sk": "PRICING" },
          ExclusiveStartKey: lastKey,
        }),
      );
      for (const item of res.Items ?? []) {
        items.push(item as TenantPricingConfig);
      }
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
    return items;
  }
}

export class PricingAuditRepository {
  async append(record: Omit<PricingAuditRecord, "id"> & { id?: string }): Promise<PricingAuditRecord> {
    if (!env.pricingAuditTable) throw new Error("PRICING_AUDIT_TABLE not configured");
    const id = record.id ?? makeId("prc");
    const ts = record.ts;
    const full: PricingAuditRecord = { ...record, id, ts };
    await ddb.send(
      new PutCommand({
        TableName: env.pricingAuditTable,
        Item: {
          pk: AUDIT_PK,
          sk: `${ts}#${id}`,
          ...full,
        },
      }),
    );
    return full;
  }

  async query(params: {
    scope?: string;
    agencyId?: string;
    limit?: number;
    before?: string;
  }): Promise<{ records: PricingAuditRecord[]; nextBefore?: string }> {
    if (!env.pricingAuditTable) return { records: [] };

    const limit = Math.min(Math.max(params.limit ?? 25, 1), 100);
    const res = await ddb.send(
      new QueryCommand({
        TableName: env.pricingAuditTable,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": AUDIT_PK },
        ScanIndexForward: false,
        Limit: limit + 50,
        ...(params.before
          ? {
              ExclusiveStartKey: { pk: AUDIT_PK, sk: params.before },
            }
          : {}),
      }),
    );

    let records = (res.Items ?? []) as Array<PricingAuditRecord & { sk?: string }>;
    if (params.scope === "global") {
      records = records.filter((r) => r.scope === "global");
    } else if (params.scope === "tenant" && params.agencyId) {
      records = records.filter((r) => r.scope === "tenant" && r.tenantId === params.agencyId);
    } else if (params.agencyId) {
      records = records.filter((r) => r.tenantId === params.agencyId);
    }

    const page = records.slice(0, limit);
    const nextBefore =
      records.length > limit && page.length > 0
        ? (page[page.length - 1] as { sk?: string }).sk
        : undefined;

    return {
      records: page.map(({ sk: _sk, ...rest }) => rest as PricingAuditRecord),
      nextBefore,
    };
  }
}

export function buildChangeEntries(
  before: PricingOverrides,
  after: PricingOverrides,
): PricingChangeEntry[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: PricingChangeEntry[] = [];
  for (const key of keys) {
    const fromVal = before[key];
    const toVal = after[key];
    if (fromVal === toVal) continue;
    if (fromVal === undefined && toVal === undefined) continue;
    changes.push({
      key,
      from: fromVal ?? 0,
      to: toVal ?? 0,
    });
  }
  return changes;
}
