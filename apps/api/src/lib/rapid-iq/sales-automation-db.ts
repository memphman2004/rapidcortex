/**
 * Sales automation persistence on RAPID_IQ_PIPELINE_SIGNALS_TABLE.
 * SEQ#{id}/META sequences, DRAFT#{id}/META content, SENT#{email}/{iso} contact window,
 * UNSUB#{email}/META local suppression.
 */

import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
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

export async function isLocallyUnsubscribed(email: string): Promise<boolean> {
  const lower = email.trim().toLowerCase();
  const res = await pipelineDdb.send(
    new GetCommand({ TableName: table(), Key: { pk: `UNSUB#${lower}`, sk: "META" } }),
  );
  return Boolean(res.Item);
}

export async function hasRecentSend(email: string, sinceIso: string): Promise<boolean> {
  const lower = email.trim().toLowerCase();
  const res = await pipelineDdb.send(
    new QueryCommand({
      TableName: table(),
      KeyConditionExpression: "pk = :pk AND sk >= :since",
      ExpressionAttributeValues: { ":pk": `SENT#${lower}`, ":since": sinceIso },
      Limit: 1,
    }),
  );
  return (res.Count ?? 0) > 0;
}
