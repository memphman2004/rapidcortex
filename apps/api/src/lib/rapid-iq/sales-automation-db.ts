/**
 * Sales automation persistence on RAPID_IQ_PIPELINE_SIGNALS_TABLE.
 * SEQ#{id}/META sequences, DRAFT#{id}/META content, SALES_CAMPAIGN#{id}/META schedule controls,
 * SENT#{email}/{iso} contact window, UNSUB#{email}/META local suppression,
 * OUTLOOK#PLATFORM/META Graph mailbox tokens,
 * OUTLOOK#USER#{userId}/META per-rep Sales Tools mailbox tokens.
 */

import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { SalesOutlookConnection } from "./outlook-graph.js";
import {
  RAPID_IQ_SALES_DRAFT_GSI2PK,
  RAPID_IQ_SALES_SEQ_GSI2PK,
  rapidIqSalesContentDraftSchema,
  rapidIqSalesSequenceSchema,
  type RapidIqSalesContentDraft,
  type RapidIqSalesSequence,
} from "rapid-cortex-shared";
import { pipelineDdb } from "./pipeline-ddb.js";

function table(): string {
  const t = process.env.RAPID_IQ_PIPELINE_SIGNALS_TABLE?.trim();
  if (!t) throw new Error("RAPID_IQ_PIPELINE_SIGNALS_TABLE_NOT_CONFIGURED");
  return t;
}

function seqPk(id: string): string {
  return `SEQ#${id}`;
}

function draftPk(id: string): string {
  return `DRAFT#${id}`;
}

const SALES_CAMPAIGN_GSI2PK = "SALES_CAMPAIGN#ALL";

export type SalesCampaignStats = {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  complained: number;
  openRate: number;
  clickRate: number;
};

export type SalesCampaignControl = {
  campaignId: string;
  deleted: boolean;
  approved: boolean;
  subject?: string;
  bodyText?: string;
  updatedAt: string;
  stats?: SalesCampaignStats;
};

export function emptySalesCampaignStats(): SalesCampaignStats {
  return {
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    unsubscribed: 0,
    complained: 0,
    openRate: 0,
    clickRate: 0,
  };
}

function recomputeRates(stats: SalesCampaignStats): SalesCampaignStats {
  const delivered = Math.max(stats.delivered, 0);
  return {
    ...stats,
    openRate: delivered > 0 ? Number(((stats.opened / delivered) * 100).toFixed(1)) : 0,
    clickRate: delivered > 0 ? Number(((stats.clicked / delivered) * 100).toFixed(1)) : 0,
  };
}

function campaignPk(id: string): string {
  return `SALES_CAMPAIGN#${id}`;
}

function parseCampaignStats(raw: unknown): SalesCampaignStats | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
  const base = {
    sent: n(s.sent),
    delivered: n(s.delivered),
    opened: n(s.opened),
    clicked: n(s.clicked),
    bounced: n(s.bounced),
    unsubscribed: n(s.unsubscribed),
    complained: n(s.complained),
    openRate: typeof s.openRate === "number" ? s.openRate : 0,
    clickRate: typeof s.clickRate === "number" ? s.clickRate : 0,
  };
  return recomputeRates(base);
}

function parseCampaignControl(item: Record<string, unknown>): SalesCampaignControl | null {
  const campaignId = typeof item.campaignId === "string" ? item.campaignId.trim() : "";
  if (!campaignId) return null;
  return {
    campaignId,
    deleted: item.deleted === true,
    approved: item.approved === true,
    subject: typeof item.subject === "string" ? item.subject : undefined,
    bodyText: typeof item.bodyText === "string" ? item.bodyText : undefined,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
    stats: parseCampaignStats(item.stats),
  };
}

function stripKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const { pk: _pk, sk: _sk, gsi1pk: _g1, gsi1sk: _g1s, gsi2pk: _g2, gsi2sk: _g2s, entityType: _e, ...rest } =
    obj;
  return rest;
}

export async function putSalesSequence(seq: RapidIqSalesSequence): Promise<void> {
  const parsed = rapidIqSalesSequenceSchema.parse(seq);
  await pipelineDdb.send(
    new PutCommand({
      TableName: table(),
      Item: {
        ...parsed,
        pk: seqPk(parsed.sequenceId),
        sk: "META",
        entityType: "sales_seq",
        gsi1pk: `SEQ_STATUS#${parsed.status}`,
        gsi1sk: parsed.updatedAt,
        gsi2pk: RAPID_IQ_SALES_SEQ_GSI2PK,
        gsi2sk: `${parsed.status}#${parsed.updatedAt}`,
      },
    }),
  );
}

export async function getSalesSequence(id: string): Promise<RapidIqSalesSequence | null> {
  const res = await pipelineDdb.send(
    new GetCommand({ TableName: table(), Key: { pk: seqPk(id), sk: "META" } }),
  );
  if (!res.Item) return null;
  const parsed = rapidIqSalesSequenceSchema.safeParse(stripKeys(res.Item as Record<string, unknown>));
  return parsed.success ? parsed.data : null;
}

export async function listSalesSequences(limit = 100): Promise<RapidIqSalesSequence[]> {
  const items: RapidIqSalesSequence[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await pipelineDdb.send(
      new QueryCommand({
        TableName: table(),
        IndexName: "gsi2-source-date",
        KeyConditionExpression: "gsi2pk = :pk",
        ExpressionAttributeValues: { ":pk": RAPID_IQ_SALES_SEQ_GSI2PK },
        ScanIndexForward: false,
        ExclusiveStartKey,
      }),
    );
    for (const item of res.Items ?? []) {
      const parsed = rapidIqSalesSequenceSchema.safeParse(stripKeys(item as Record<string, unknown>));
      if (parsed.success) items.push(parsed.data);
      if (items.length >= limit) return items;
    }
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return items;
}

export async function putSalesDraft(draft: RapidIqSalesContentDraft): Promise<void> {
  const parsed = rapidIqSalesContentDraftSchema.parse(draft);
  await pipelineDdb.send(
    new PutCommand({
      TableName: table(),
      Item: {
        ...parsed,
        pk: draftPk(parsed.draftId),
        sk: "META",
        entityType: "sales_draft",
        gsi1pk: `DRAFT_STATUS#${parsed.status}`,
        gsi1sk: parsed.updatedAt,
        gsi2pk: RAPID_IQ_SALES_DRAFT_GSI2PK,
        gsi2sk: parsed.updatedAt,
      },
    }),
  );
}

export async function getSalesDraft(id: string): Promise<RapidIqSalesContentDraft | null> {
  const res = await pipelineDdb.send(
    new GetCommand({ TableName: table(), Key: { pk: draftPk(id), sk: "META" } }),
  );
  if (!res.Item) return null;
  const parsed = rapidIqSalesContentDraftSchema.safeParse(stripKeys(res.Item as Record<string, unknown>));
  return parsed.success ? parsed.data : null;
}

export async function deleteSalesSequence(id: string): Promise<boolean> {
  const existing = await getSalesSequence(id);
  if (!existing) return false;
  await pipelineDdb.send(
    new DeleteCommand({ TableName: table(), Key: { pk: seqPk(id), sk: "META" } }),
  );
  return true;
}

export async function deleteSalesDraft(id: string): Promise<boolean> {
  const existing = await getSalesDraft(id);
  if (!existing) return false;
  await pipelineDdb.send(
    new DeleteCommand({ TableName: table(), Key: { pk: draftPk(id), sk: "META" } }),
  );
  return true;
}

export async function getSalesCampaignControl(id: string): Promise<SalesCampaignControl | null> {
  const res = await pipelineDdb.send(
    new GetCommand({ TableName: table(), Key: { pk: campaignPk(id), sk: "META" } }),
  );
  if (!res.Item) return null;
  return parseCampaignControl(res.Item as Record<string, unknown>);
}

export async function listSalesCampaignControls(): Promise<SalesCampaignControl[]> {
  const items: SalesCampaignControl[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await pipelineDdb.send(
      new QueryCommand({
        TableName: table(),
        IndexName: "gsi2-source-date",
        KeyConditionExpression: "gsi2pk = :pk",
        ExpressionAttributeValues: { ":pk": SALES_CAMPAIGN_GSI2PK },
        ExclusiveStartKey,
      }),
    );
    for (const item of res.Items ?? []) {
      const parsed = parseCampaignControl(item as Record<string, unknown>);
      if (parsed) items.push(parsed);
    }
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return items;
}

export async function upsertSalesCampaignControl(
  id: string,
  patch: Partial<Pick<SalesCampaignControl, "deleted" | "approved" | "subject" | "bodyText" | "stats">>,
): Promise<SalesCampaignControl> {
  const current = await getSalesCampaignControl(id);
  const next: SalesCampaignControl = {
    campaignId: id,
    deleted: patch.deleted ?? current?.deleted ?? false,
    approved: patch.approved ?? current?.approved ?? false,
    subject: patch.subject !== undefined ? patch.subject : current?.subject,
    bodyText: patch.bodyText !== undefined ? patch.bodyText : current?.bodyText,
    stats: patch.stats !== undefined ? recomputeRates(patch.stats) : current?.stats,
    updatedAt: new Date().toISOString(),
  };
  await pipelineDdb.send(
    new PutCommand({
      TableName: table(),
      Item: {
        ...next,
        pk: campaignPk(id),
        sk: "META",
        entityType: "sales_campaign",
        gsi2pk: SALES_CAMPAIGN_GSI2PK,
        gsi2sk: next.updatedAt,
      },
    }),
  );
  return next;
}

export type SalesCampaignStatKey =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "unsubscribed"
  | "complained";

/** Atomic-ish increment of a campaign engagement counter (read → write). */
export async function incrementSalesCampaignStat(
  campaignId: string,
  key: SalesCampaignStatKey,
  by = 1,
): Promise<SalesCampaignStats> {
  const id = campaignId.trim();
  if (!id) return emptySalesCampaignStats();
  const current = await getSalesCampaignControl(id);
  const stats = { ...(current?.stats ?? emptySalesCampaignStats()) };
  stats[key] = Math.max(0, (stats[key] ?? 0) + by);
  const next = recomputeRates(stats);
  await upsertSalesCampaignControl(id, {
    deleted: current?.deleted ?? false,
    approved: current?.approved ?? false,
    subject: current?.subject,
    bodyText: current?.bodyText,
    stats: next,
  });
  return next;
}

export async function listSalesDrafts(limit = 50): Promise<RapidIqSalesContentDraft[]> {
  const items: RapidIqSalesContentDraft[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await pipelineDdb.send(
      new QueryCommand({
        TableName: table(),
        IndexName: "gsi2-source-date",
        KeyConditionExpression: "gsi2pk = :pk",
        ExpressionAttributeValues: { ":pk": RAPID_IQ_SALES_DRAFT_GSI2PK },
        ScanIndexForward: false,
        ExclusiveStartKey,
      }),
    );
    for (const item of res.Items ?? []) {
      const parsed = rapidIqSalesContentDraftSchema.safeParse(stripKeys(item as Record<string, unknown>));
      if (parsed.success) items.push(parsed.data);
      if (items.length >= limit) return items;
    }
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return items;
}

export async function recordSalesSend(email: string, atIso: string, sequenceId: string): Promise<void> {
  const lower = email.trim().toLowerCase();
  await pipelineDdb.send(
    new PutCommand({
      TableName: table(),
      Item: {
        pk: `SENT#${lower}`,
        sk: atIso,
        entityType: "sales_sent",
        sequenceId,
        createdAt: atIso,
      },
    }),
  );
}

export async function putSalesUnsubscribe(email: string): Promise<void> {
  const lower = email.trim().toLowerCase();
  const now = new Date().toISOString();
  await pipelineDdb.send(
    new PutCommand({
      TableName: table(),
      Item: { pk: `UNSUB#${lower}`, sk: "META", entityType: "sales_unsub", createdAt: now },
    }),
  );
}

/** Admin / Save-contact re-opt-in clears the local suppression key. */
export async function clearSalesUnsubscribe(email: string): Promise<void> {
  const lower = email.trim().toLowerCase();
  if (!lower) return;
  await pipelineDdb.send(
    new DeleteCommand({
      TableName: table(),
      Key: { pk: `UNSUB#${lower}`, sk: "META" },
    }),
  );
}

export async function isLocallyUnsubscribed(email: string): Promise<boolean> {
  const lower = email.trim().toLowerCase();
  const res = await pipelineDdb.send(
    new GetCommand({ TableName: table(), Key: { pk: `UNSUB#${lower}`, sk: "META" } }),
  );
  return Boolean(res.Item);
}

export async function hasRecentSend(
  email: string,
  sinceIso: string,
  exceptSequenceId?: string,
): Promise<boolean> {
  const lower = email.trim().toLowerCase();
  const res = await pipelineDdb.send(
    new QueryCommand({
      TableName: table(),
      KeyConditionExpression: "pk = :pk AND sk >= :since",
      ExpressionAttributeValues: { ":pk": `SENT#${lower}`, ":since": sinceIso },
      Limit: exceptSequenceId ? 25 : 1,
    }),
  );
  const items = res.Items ?? [];
  if (!exceptSequenceId) return items.length > 0;
  return items.some((item) => String(item.sequenceId ?? "") !== exceptSequenceId);
}

const OUTLOOK_PK = "OUTLOOK#PLATFORM";
const OUTLOOK_SK = "META";

export async function putOutlookConnection(conn: SalesOutlookConnection): Promise<void> {
  await pipelineDdb.send(
    new PutCommand({
      TableName: table(),
      Item: {
        ...conn,
        pk: OUTLOOK_PK,
        sk: OUTLOOK_SK,
        entityType: "sales_outlook",
        agencyId: "platform",
      },
    }),
  );
}

export async function getOutlookConnection(): Promise<SalesOutlookConnection | null> {
  const res = await pipelineDdb.send(
    new GetCommand({ TableName: table(), Key: { pk: OUTLOOK_PK, sk: OUTLOOK_SK } }),
  );
  if (!res.Item) return null;
  const item = res.Item as Record<string, unknown>;
  const mailbox = typeof item.mailbox === "string" ? item.mailbox : "";
  if (!mailbox) return null;
  return {
    agencyId: "platform",
    mailbox,
    mock: item.mock === true,
    refreshTokenEnc: typeof item.refreshTokenEnc === "string" ? item.refreshTokenEnc : undefined,
    accessTokenEnc: typeof item.accessTokenEnc === "string" ? item.accessTokenEnc : undefined,
    accessTokenExpiresAt:
      typeof item.accessTokenExpiresAt === "string" ? item.accessTokenExpiresAt : undefined,
    connectedBy: typeof item.connectedBy === "string" ? item.connectedBy : "unknown",
    connectedAt: typeof item.connectedAt === "string" ? item.connectedAt : new Date().toISOString(),
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
  };
}

export async function deleteOutlookConnection(): Promise<void> {
  await pipelineDdb.send(
    new DeleteCommand({ TableName: table(), Key: { pk: OUTLOOK_PK, sk: OUTLOOK_SK } }),
  );
}

function userOutlookPk(userId: string): string {
  return `OUTLOOK#USER#${userId.trim()}`;
}

export async function putUserOutlookConnection(
  userId: string,
  conn: SalesOutlookConnection,
): Promise<void> {
  const uid = userId.trim();
  if (!uid) throw new Error("USER_ID_REQUIRED");
  await pipelineDdb.send(
    new PutCommand({
      TableName: table(),
      Item: {
        ...conn,
        pk: userOutlookPk(uid),
        sk: OUTLOOK_SK,
        entityType: "sales_outlook_user",
        agencyId: "platform",
        userId: uid,
      },
    }),
  );
}

export async function getUserOutlookConnection(
  userId: string,
): Promise<SalesOutlookConnection | null> {
  const uid = userId.trim();
  if (!uid) return null;
  const res = await pipelineDdb.send(
    new GetCommand({ TableName: table(), Key: { pk: userOutlookPk(uid), sk: OUTLOOK_SK } }),
  );
  if (!res.Item) return null;
  const item = res.Item as Record<string, unknown>;
  const mailbox = typeof item.mailbox === "string" ? item.mailbox : "";
  if (!mailbox) return null;
  return {
    agencyId: "platform",
    userId: uid,
    mailbox,
    mock: item.mock === true,
    refreshTokenEnc: typeof item.refreshTokenEnc === "string" ? item.refreshTokenEnc : undefined,
    accessTokenEnc: typeof item.accessTokenEnc === "string" ? item.accessTokenEnc : undefined,
    accessTokenExpiresAt:
      typeof item.accessTokenExpiresAt === "string" ? item.accessTokenExpiresAt : undefined,
    connectedBy: typeof item.connectedBy === "string" ? item.connectedBy : "unknown",
    connectedAt: typeof item.connectedAt === "string" ? item.connectedAt : new Date().toISOString(),
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
  };
}

export async function deleteUserOutlookConnection(userId: string): Promise<void> {
  const uid = userId.trim();
  if (!uid) return;
  await pipelineDdb.send(
    new DeleteCommand({
      TableName: table(),
      Key: { pk: userOutlookPk(uid), sk: OUTLOOK_SK },
    }),
  );
}
