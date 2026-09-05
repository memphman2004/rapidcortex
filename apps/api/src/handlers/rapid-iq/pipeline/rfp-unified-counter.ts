/**
 * Denormalized RFP counts across opportunity feed + pipeline signals + intel.
 * Snapshot lives on RAPID_IQ_PIPELINE_SIGNALS_TABLE (pk=RFP_COUNTS, sk=LATEST).
 * No extra Dynamo table.
 */

import { GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import {
  RAPID_IQ_RFP_COUNT_PK,
  RAPID_IQ_RFP_COUNT_SK,
  accumulateRfpCount,
  emptyRfpVerticalCounts,
  isRfpCountIndexRow,
  isUnifiedRfpRecord,
  sumRfpVerticalCounts,
  type RapidIqRfpCountSnapshot,
  type RapidIqRfpVerticalCounts,
} from "rapid-cortex-shared";
import { pipelineDdb } from "../../../lib/rapid-iq/pipeline-ddb.js";

function pipelineTable(): string {
  const t = process.env.RAPID_IQ_PIPELINE_SIGNALS_TABLE?.trim();
  if (!t) throw new Error("RAPID_IQ_PIPELINE_SIGNALS_TABLE_NOT_CONFIGURED");
  return t;
}

function opportunitiesTable(): string {
  return process.env.RAPID_IQ_OPPORTUNITIES_TABLE?.trim() ?? "";
}

async function fullScan(tableName: string): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await pipelineDdb.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey,
      }),
    );
    items.push(...((res.Items ?? []) as Record<string, unknown>[]));
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return items;
}

function countStore(
  items: Record<string, unknown>[],
  kind: "feed" | "pipeline" | "intel",
): RapidIqRfpVerticalCounts {
  const counts = emptyRfpVerticalCounts();
  for (const item of items) {
    if (kind === "feed") {
      if (!isUnifiedRfpRecord(item)) continue;
      accumulateRfpCount(counts, item);
      continue;
    }
    if (!isRfpCountIndexRow(item)) continue;
    const pk = String(item.pk ?? "");
    if (kind === "pipeline" && !pk.startsWith("SIGNAL#")) continue;
    if (kind === "intel" && !pk.startsWith("INTEL#")) continue;
    if (!isUnifiedRfpRecord(item)) continue;
    accumulateRfpCount(counts, item);
  }
  return counts;
}

export async function buildRfpCountSnapshot(): Promise<RapidIqRfpCountSnapshot> {
  const feedTable = opportunitiesTable();
  const pipeTable = pipelineTable();

  const feedItems = feedTable ? await fullScan(feedTable) : [];
  const pipelineItems = await fullScan(pipeTable);

  const opportunityFeed = countStore(feedItems, "feed");
  const pipeline = countStore(pipelineItems, "pipeline");
  const intel = countStore(pipelineItems, "intel");
  const total = sumRfpVerticalCounts(opportunityFeed, pipeline, intel);

  return {
    pk: RAPID_IQ_RFP_COUNT_PK,
    sk: RAPID_IQ_RFP_COUNT_SK,
    entityType: "rfp_count",
    updatedAt: new Date().toISOString(),
    opportunityFeed,
    pipeline,
    intel,
    total,
  };
}

export async function putRfpCountSnapshot(snapshot: RapidIqRfpCountSnapshot): Promise<void> {
  await pipelineDdb.send(
    new PutCommand({
      TableName: pipelineTable(),
      Item: snapshot,
    }),
  );
}

export async function getRfpCountSnapshot(): Promise<RapidIqRfpCountSnapshot | null> {
  try {
    const res = await pipelineDdb.send(
      new GetCommand({
        TableName: pipelineTable(),
        Key: { pk: RAPID_IQ_RFP_COUNT_PK, sk: RAPID_IQ_RFP_COUNT_SK },
      }),
    );
    if (!res.Item) return null;
    const item = res.Item as RapidIqRfpCountSnapshot;
    if (item.entityType !== "rfp_count" || !item.total) return null;
    return item;
  } catch {
    return null;
  }
}

export async function handler(): Promise<RapidIqRfpCountSnapshot> {
  const snapshot = await buildRfpCountSnapshot();
  await putRfpCountSnapshot(snapshot);
  console.log(
    JSON.stringify({
      msg: "rapid_iq_rfp_count_snapshot",
      feed: snapshot.opportunityFeed.open,
      pipeline: snapshot.pipeline.open,
      intel: snapshot.intel.open,
      total: snapshot.total.open,
    }),
  );
  return snapshot;
}
