import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  AgencyPriceOverride,
  AuditAction,
  CatalogItem,
  PricingAuditEntry,
} from "rapid-cortex-shared";

const TABLE = process.env.PRICING_TABLE ?? "";
const PK_GLOBAL = "PRICING#GLOBAL";
const PK_AUDIT = "PRICING#AUDIT";
const agencyPk = (id: string) => `PRICING#AGENCY#${id}`;

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

const CAT_SK_PREFIX: Record<string, string> = {
  core: "PLAN",
  addon: "ADDON",
  support: "SUPPORT",
  professional: "PROFESSIONAL",
  vertical: "VERTICAL",
  rc_lite: "RC_LITE",
};

function skForItem(item: CatalogItem): string {
  const prefix = CAT_SK_PREFIX[item.category] ?? item.category.toUpperCase();
  const sub = item.subcategory
    ? item.subcategory.replace(/[^a-zA-Z0-9_-]/g, "_")
    : "";
  return sub ? `${prefix}#${sub}#${item.id}` : `${prefix}#${item.id}`;
}

export async function readGlobalConfig(): Promise<{
  version: number;
  updatedAt: string;
  updatedBy: string;
  items: CatalogItem[];
}> {
  if (!TABLE) {
    return { version: 0, updatedAt: new Date(0).toISOString(), updatedBy: "system", items: [] };
  }

  const res = await client.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": PK_GLOBAL },
    }),
  );

  let version = 0;
  let updatedAt = new Date(0).toISOString();
  let updatedBy = "system";
  const items: CatalogItem[] = [];

  for (const row of res.Items ?? []) {
    if (row.sk === "CONFIG#META") {
      version = (row.version as number) ?? 0;
      updatedAt = (row.updatedAt as string) ?? updatedAt;
      updatedBy = (row.updatedBy as string) ?? updatedBy;
    } else if (row.item) {
      items.push(row.item as CatalogItem);
    }
  }

  items.sort((a, b) => a.sortOrder - b.sortOrder);

  return { version, updatedAt, updatedBy, items };
}

export async function readCatalog(agencyId?: string): Promise<{
  items: CatalogItem[];
  version: number;
  updatedAt: string;
}> {
  const global = await readGlobalConfig();

  if (!agencyId) {
    return { items: global.items, version: global.version, updatedAt: global.updatedAt };
  }

  const overridesRes = await client.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": agencyPk(agencyId) },
    }),
  );

  const overrideMap = new Map<string, Partial<CatalogItem>>();
  for (const row of overridesRes.Items ?? []) {
    if (row.itemId && row.overridePrice) {
      overrideMap.set(row.itemId as string, row.overridePrice as Partial<CatalogItem>);
    }
  }

  const items = global.items.map((item) => {
    const override = overrideMap.get(item.id);
    return override ? { ...item, ...override } : item;
  });

  return { items, version: global.version, updatedAt: global.updatedAt };
}

export async function writeGlobalConfig(
  items: CatalogItem[],
  userId: string,
  userEmail: string,
  reason: string,
  currentVersion: number,
): Promise<{ version: number; updatedAt: string }> {
  if (!TABLE) throw new Error("PRICING_TABLE not configured");

  const now = new Date().toISOString();
  const nextVersion = currentVersion + 1;

  // BatchWrite in 23-item chunks (leaves room for the META + audit TransactWrite items)
  const CHUNK = 23;
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    await client.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE]: chunk.map((item) => ({
            PutRequest: {
              Item: {
                pk: PK_GLOBAL,
                sk: skForItem(item),
                item: { ...item, updatedAt: now, updatedBy: userEmail },
                updatedAt: now,
              },
            },
          })),
        },
      }),
    );
  }

  const auditSk = `${now}#${userId}`;
  await client.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: TABLE,
            Item: {
              pk: PK_GLOBAL,
              sk: "CONFIG#META",
              version: nextVersion,
              updatedAt: now,
              updatedBy: userEmail,
            },
          },
        },
        {
          Put: {
            TableName: TABLE,
            Item: {
              pk: PK_AUDIT,
              sk: auditSk,
              action: "CONFIG_WRITE" as AuditAction,
              userId,
              userEmail,
              reason,
              version: nextVersion,
              updatedAt: now,
            },
          },
        },
      ],
    }),
  );

  return { version: nextVersion, updatedAt: now };
}

export async function upsertItem(
  item: CatalogItem,
  userId: string,
  userEmail: string,
  reason: string,
  before?: CatalogItem,
  expectedUpdatedAt?: string,
): Promise<void> {
  if (!TABLE) throw new Error("PRICING_TABLE not configured");

  const now = new Date().toISOString();
  const updated = { ...item, updatedAt: now, updatedBy: userEmail };
  const action: AuditAction = before ? "ITEM_UPDATE" : "ITEM_CREATE";

  await client.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: TABLE,
            Item: { pk: PK_GLOBAL, sk: skForItem(updated), item: updated, updatedAt: now },
            ...(expectedUpdatedAt
              ? {
                  ConditionExpression: "attribute_not_exists(pk) OR #upd = :expected",
                  ExpressionAttributeNames: { "#upd": "updatedAt" },
                  ExpressionAttributeValues: { ":expected": expectedUpdatedAt },
                }
              : {}),
          },
        },
        {
          Put: {
            TableName: TABLE,
            Item: {
              pk: PK_AUDIT,
              sk: `${now}#${userId}`,
              action,
              userId,
              userEmail,
              reason,
              diff: before ? { before, after: updated } : { after: updated },
              version: 0,
              updatedAt: now,
            },
          },
        },
      ],
    }),
  );
}

export async function writeAgencyOverride(
  override: AgencyPriceOverride,
  userId: string,
  userEmail: string,
): Promise<void> {
  if (!TABLE) throw new Error("PRICING_TABLE not configured");

  const now = new Date().toISOString();
  await client.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: TABLE,
            Item: {
              pk: agencyPk(override.agencyId),
              sk: `OVERRIDE#${override.itemId}`,
              itemId: override.itemId,
              overridePrice: override.overridePrice,
              reason: override.reason,
              appliedBy: userEmail,
              appliedAt: now,
            },
          },
        },
        {
          Put: {
            TableName: TABLE,
            Item: {
              pk: PK_AUDIT,
              sk: `${now}#${userId}`,
              action: "AGENCY_OVERRIDE_SET" as AuditAction,
              userId,
              userEmail,
              reason: override.reason,
              diff: {
                agencyId: override.agencyId,
                itemId: override.itemId,
                override: override.overridePrice,
              },
              version: 0,
              updatedAt: now,
            },
          },
        },
      ],
    }),
  );
}

export async function readAuditLog(limit = 100): Promise<PricingAuditEntry[]> {
  if (!TABLE) return [];

  const res = await client.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": PK_AUDIT },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );

  return (res.Items ?? []) as PricingAuditEntry[];
}
