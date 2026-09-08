import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  CampusSecurityAuthority,
  CleryPublicSettings,
  CleryRecord,
  CleryZoneConfig,
  DailyCrimeLogEntry,
} from "rapid-cortex-shared";
import { canUnfoundCrime, UNFOUND_FORBIDDEN_MESSAGE } from "rapid-cortex-shared";
import { ddb } from "../../repositories/baseRepository.js";
import { env } from "../../lib/env.js";

function table(): string {
  const t = env.cleryActTable;
  if (!t) throw new Error("CLERY_ACT_TABLE is not configured");
  return t;
}

export const CLERY_SK = {
  rec: (recordId: string) => `REC#${recordId}`,
  dcl: (entryId: string) => `DCL#${entryId}`,
  csa: (userId: string) => `CSA#${userId}`,
  zone: (rcli: string) => `ZONE#${rcli}`,
  asr: (year: number) => `ASR#${year}`,
  policy: (year: number, section: string) => `POL#${year}#${section}`,
  publicCfg: () => `CFG#PUBLIC`,
};

type AsrPolicyItem = {
  agencyId: string;
  sk: string;
  reportYear: number;
  section: string;
  body: string;
  updatedAt: string;
  updatedBy: string;
};

type AsrReportItem = {
  agencyId: string;
  sk: string;
  reportId: string;
  reportYear: number;
  coverageYears: [number, number, number];
  publishDeadline: string;
  status: "DRAFT" | "REVIEW" | "PUBLISHED";
  generatedBy: string;
  generatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  updatedAt: string;
};

async function put(item: Record<string, unknown>): Promise<void> {
  await ddb.send(new PutCommand({ TableName: table(), Item: item }));
}

async function getItem<T>(agencyId: string, sk: string): Promise<T | null> {
  const out = await ddb.send(new GetCommand({ TableName: table(), Key: { agencyId, sk } }));
  return (out.Item as T | undefined) ?? null;
}

async function queryPrefix<T>(agencyId: string, prefix: string): Promise<T[]> {
  const items: T[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "agencyId = :a AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":a": agencyId, ":p": prefix },
        ExclusiveStartKey: startKey,
      }),
    );
    items.push(...((out.Items ?? []) as T[]));
    startKey = out.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (startKey);
  return items;
}

function stripKeys<T extends Record<string, unknown>>(item: T): T {
  const { pk: _pk, sk: _sk, gsi1pk: _g1, gsi1sk: _g2, itemType: _t, ...rest } = item;
  return rest as T;
}

export const cleryActStore = {
  async putRecord(record: CleryRecord): Promise<void> {
    await put({
      ...record,
      sk: CLERY_SK.rec(record.recordId),
      itemType: "REC",
    });
  },

  async getRecord(agencyId: string, recordId: string): Promise<CleryRecord | null> {
    const item = await getItem<CleryRecord & { sk: string }>(agencyId, CLERY_SK.rec(recordId));
    return item ? (stripKeys(item) as CleryRecord) : null;
  },

  async listRecords(agencyId: string): Promise<CleryRecord[]> {
    const items = await queryPrefix<CleryRecord & { sk: string }>(agencyId, "REC#");
    return items.map((i) => stripKeys(i) as CleryRecord);
  },

  async putDcl(entry: DailyCrimeLogEntry): Promise<void> {
    await put({
      ...entry,
      sk: CLERY_SK.dcl(entry.entryId),
      itemType: "DCL",
    });
  },

  async getDcl(agencyId: string, entryId: string): Promise<DailyCrimeLogEntry | null> {
    const item = await getItem<DailyCrimeLogEntry & { sk: string }>(agencyId, CLERY_SK.dcl(entryId));
    return item ? (stripKeys(item) as DailyCrimeLogEntry) : null;
  },

  async listDcl(agencyId: string): Promise<DailyCrimeLogEntry[]> {
    const items = await queryPrefix<DailyCrimeLogEntry & { sk: string }>(agencyId, "DCL#");
    return items.map((i) => stripKeys(i) as DailyCrimeLogEntry);
  },

  async putCsa(csa: CampusSecurityAuthority): Promise<void> {
    await put({
      ...csa,
      sk: CLERY_SK.csa(csa.userId),
      itemType: "CSA",
    });
  },

  async getCsa(agencyId: string, userId: string): Promise<CampusSecurityAuthority | null> {
    const item = await getItem<CampusSecurityAuthority & { sk: string }>(agencyId, CLERY_SK.csa(userId));
    return item ? (stripKeys(item) as CampusSecurityAuthority) : null;
  },

  async listCsa(agencyId: string): Promise<CampusSecurityAuthority[]> {
    const items = await queryPrefix<CampusSecurityAuthority & { sk: string }>(agencyId, "CSA#");
    return items.map((i) => stripKeys(i) as CampusSecurityAuthority);
  },

  async deleteCsa(agencyId: string, userId: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({ TableName: table(), Key: { agencyId, sk: CLERY_SK.csa(userId) } }),
    );
  },

  async putZone(zone: CleryZoneConfig): Promise<void> {
    await put({
      ...zone,
      sk: CLERY_SK.zone(zone.rcli),
      itemType: "ZONE",
    });
  },

  async getZone(agencyId: string, rcli: string): Promise<CleryZoneConfig | null> {
    const item = await getItem<CleryZoneConfig & { sk: string }>(agencyId, CLERY_SK.zone(rcli));
    return item ? (stripKeys(item) as CleryZoneConfig) : null;
  },

  async listZones(agencyId: string): Promise<CleryZoneConfig[]> {
    const items = await queryPrefix<CleryZoneConfig & { sk: string }>(agencyId, "ZONE#");
    return items.map((i) => stripKeys(i) as CleryZoneConfig);
  },

  async putPublicSettings(settings: CleryPublicSettings): Promise<void> {
    await put({
      ...settings,
      sk: CLERY_SK.publicCfg(),
      itemType: "CFG",
    });
  },

  async getPublicSettings(agencyId: string): Promise<CleryPublicSettings | null> {
    const item = await getItem<CleryPublicSettings & { sk: string }>(agencyId, CLERY_SK.publicCfg());
    return item ? (stripKeys(item) as CleryPublicSettings) : null;
  },

  async putPolicy(item: AsrPolicyItem): Promise<void> {
    await put({ ...item, itemType: "POL" });
  },

  async listPolicies(agencyId: string, year: number): Promise<AsrPolicyItem[]> {
    return queryPrefix<AsrPolicyItem>(agencyId, `POL#${year}#`);
  },

  async putAsrReport(item: AsrReportItem): Promise<void> {
    await put({ ...item, itemType: "ASR" });
  },

  async getAsrReport(agencyId: string, year: number): Promise<AsrReportItem | null> {
    return getItem<AsrReportItem>(agencyId, CLERY_SK.asr(year));
  },

  async listAsrReports(agencyId: string): Promise<AsrReportItem[]> {
    return queryPrefix<AsrReportItem>(agencyId, "ASR#");
  },
};

export async function assertSwornOfficerMayUnfound(
  agencyId: string,
  userId: string,
): Promise<CampusSecurityAuthority> {
  if (!env.cleryActTable) {
    throw Object.assign(new Error(UNFOUND_FORBIDDEN_MESSAGE), { code: "UNFOUND_NOT_SWORN" });
  }
  const csa = await cleryActStore.getCsa(agencyId, userId);
  if (!csa || !canUnfoundCrime(csa)) {
    throw Object.assign(new Error(UNFOUND_FORBIDDEN_MESSAGE), { code: "UNFOUND_NOT_SWORN" });
  }
  return csa;
}
