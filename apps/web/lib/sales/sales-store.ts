/**
 * Sales enablement persistence.
 * Uses Dynamo when the corresponding table env var is set; otherwise in-memory
 * (local/dev before tables are wired onto the web task).
 */
import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

type MemoryDb = {
  roi: Map<string, Record<string, unknown>>;
  activity: Map<string, Record<string, unknown>[]>;
  claims: Map<string, Record<string, unknown>>;
  rfp: Map<string, Record<string, unknown>>;
  freeTier: Map<string, Record<string, unknown>>;
};

const g = globalThis as typeof globalThis & {
  __nexcortSalesMem?: MemoryDb;
  __nexcortSalesDdb?: DynamoDBDocumentClient;
};

function mem(): MemoryDb {
  if (!g.__nexcortSalesMem) {
    g.__nexcortSalesMem = {
      roi: new Map(),
      activity: new Map(),
      claims: new Map(),
      rfp: new Map(),
      freeTier: new Map(),
    };
  }
  return g.__nexcortSalesMem;
}

function trimEnv(name: string): string | null {
  const v = process.env[name]?.trim();
  return v ? v : null;
}

function roiTable(): string | null {
  return trimEnv("ROI_SESSIONS_TABLE_NAME");
}
function activityTable(): string | null {
  return trimEnv("SALES_ACTIVITY_TABLE_NAME");
}
function claimsTable(): string | null {
  return trimEnv("SALES_CLAIMS_TABLE_NAME");
}
function rfpTable(): string | null {
  return trimEnv("SALES_RFP_TABLE_NAME");
}
function freeTierTable(): string | null {
  return trimEnv("FREE_TIER_REGISTRATIONS_TABLE_NAME");
}

export function salesTablesConfigured(): boolean {
  return Boolean(
    roiTable() || activityTable() || claimsTable() || rfpTable() || freeTierTable(),
  );
}

function docClient(): DynamoDBDocumentClient {
  if (!g.__nexcortSalesDdb) {
    const client = new DynamoDBClient(
      process.env.AWS_REGION ? { region: process.env.AWS_REGION } : {},
    );
    g.__nexcortSalesDdb = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return g.__nexcortSalesDdb;
}

function asItem(raw: Record<string, unknown> | undefined | null): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  return raw;
}

export async function putRoiSession(item: Record<string, unknown>): Promise<void> {
  const token = String(item.roiToken ?? "");
  const table = roiTable();
  if (!table) {
    mem().roi.set(token, item);
    return;
  }
  await docClient().send(new PutCommand({ TableName: table, Item: item }));
}

export async function getRoiSession(token: string): Promise<Record<string, unknown> | null> {
  const table = roiTable();
  if (!table) {
    return mem().roi.get(token) ?? null;
  }
  const out = await docClient().send(
    new GetCommand({ TableName: table, Key: { roiToken: token } }),
  );
  return asItem(out.Item as Record<string, unknown> | undefined);
}

export async function putActivityReport(
  contractorEmail: string,
  item: Record<string, unknown>,
): Promise<void> {
  const table = activityTable();
  const weekOf = String(item.weekOf ?? "");
  const row = { ...item, contractorEmail, weekOf };
  if (!table) {
    const list = mem().activity.get(contractorEmail) ?? [];
    const next = list.filter((x) => String(x.weekOf) !== weekOf);
    next.unshift(row);
    mem().activity.set(contractorEmail, next.slice(0, 52));
    return;
  }
  await docClient().send(new PutCommand({ TableName: table, Item: row }));
}

export async function listActivityReports(contractorEmail: string): Promise<Record<string, unknown>[]> {
  const table = activityTable();
  if (!table) {
    return mem().activity.get(contractorEmail) ?? [];
  }
  const out = await docClient().send(
    new QueryCommand({
      TableName: table,
      KeyConditionExpression: "contractorEmail = :e",
      ExpressionAttributeValues: { ":e": contractorEmail },
      ScanIndexForward: false,
      Limit: 52,
    }),
  );
  return (out.Items ?? []) as Record<string, unknown>[];
}

export async function putClaim(item: Record<string, unknown>): Promise<void> {
  const slug = String(item.agencySlug ?? "");
  const table = claimsTable();
  if (!table) {
    mem().claims.set(slug, item);
    return;
  }
  await docClient().send(new PutCommand({ TableName: table, Item: item }));
}

export async function deleteClaim(agencySlug: string, email: string): Promise<boolean> {
  const table = claimsTable();
  if (!table) {
    const existing = mem().claims.get(agencySlug);
    if (!existing) return false;
    if (String(existing.claimedByEmail).toLowerCase() !== email.toLowerCase()) return false;
    mem().claims.delete(agencySlug);
    return true;
  }
  const existing = await docClient().send(
    new GetCommand({ TableName: table, Key: { agencySlug } }),
  );
  const item = asItem(existing.Item as Record<string, unknown> | undefined);
  if (!item) return false;
  if (String(item.claimedByEmail ?? "").toLowerCase() !== email.toLowerCase()) return false;
  await docClient().send(new DeleteCommand({ TableName: table, Key: { agencySlug } }));
  return true;
}

export async function listClaims(): Promise<Record<string, unknown>[]> {
  const table = claimsTable();
  if (!table) {
    return [...mem().claims.values()];
  }
  const items: Record<string, unknown>[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const out = await docClient().send(
      new ScanCommand({
        TableName: table,
        ExclusiveStartKey: startKey,
        Limit: 200,
      }),
    );
    for (const row of out.Items ?? []) {
      items.push(row as Record<string, unknown>);
    }
    startKey = out.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (startKey);
  return items;
}

export async function putRfp(item: Record<string, unknown>): Promise<void> {
  const table = rfpTable();
  if (!table) {
    mem().rfp.set(String(item.rfpId), item);
    return;
  }
  await docClient().send(new PutCommand({ TableName: table, Item: item }));
}

export async function getRfp(rfpId: string): Promise<Record<string, unknown> | null> {
  const table = rfpTable();
  if (!table) {
    return mem().rfp.get(rfpId) ?? null;
  }
  const out = await docClient().send(
    new GetCommand({ TableName: table, Key: { rfpId } }),
  );
  return asItem(out.Item as Record<string, unknown> | undefined);
}

export async function deleteRfp(rfpId: string): Promise<void> {
  const table = rfpTable();
  if (!table) {
    mem().rfp.delete(rfpId);
    return;
  }
  await docClient().send(new DeleteCommand({ TableName: table, Key: { rfpId } }));
}

export async function listRfps(): Promise<Record<string, unknown>[]> {
  const table = rfpTable();
  if (!table) {
    return [...mem().rfp.values()].sort((a, b) =>
      String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
    );
  }
  const items: Record<string, unknown>[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const out = await docClient().send(
      new ScanCommand({
        TableName: table,
        ExclusiveStartKey: startKey,
        Limit: 200,
      }),
    );
    for (const row of out.Items ?? []) {
      items.push(row as Record<string, unknown>);
    }
    startKey = out.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (startKey);
  return items.sort((a, b) =>
    String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
  );
}

export async function putFreeTierRegistration(item: Record<string, unknown>): Promise<void> {
  const table = freeTierTable();
  if (!table) {
    mem().freeTier.set(String(item.registrationId), item);
    return;
  }
  await docClient().send(new PutCommand({ TableName: table, Item: item }));
}
