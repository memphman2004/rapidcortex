/**
 * DynamoDB access for Rapid IQ pipeline signals
 * (table: RAPID_IQ_PIPELINE_SIGNALS_TABLE — not RAPID_IQ_SIGNALS_TABLE).
 */

import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { createHash } from "node:crypto";
import type {
  RapidIqPipelineSignal,
  RapidIqPipelineSignalStatus,
} from "rapid-cortex-shared";
import { env } from "../../env.js";
import { ddb } from "../../../repositories/baseRepository.js";

function table(): string {
  const t = env.rapidIqPipelineSignalsTable?.trim() || process.env.RAPID_IQ_PIPELINE_SIGNALS_TABLE?.trim();
  if (!t) throw new Error("RAPID_IQ_PIPELINE_SIGNALS_TABLE_NOT_CONFIGURED");
  return t;
}

function pk(signalId: string) {
  return `SIGNAL#${signalId}`;
}

function gsi1pk(status: RapidIqPipelineSignalStatus) {
  return `STATUS#${status}`;
}

function gsi1sk(fitScore: number, signalDate: string) {
  return `${String(fitScore).padStart(3, "0")}#${signalDate}`;
}

/** SHA-256 fingerprint of title + snippet prefix for dedup (hex, 32 chars). */
export function contentHash(title: string, snippet: string): string {
  return createHash("sha256")
    .update(`${title}|${snippet.slice(0, 500)}`)
    .digest("hex")
    .slice(0, 32);
}

export async function signalExistsByHash(hash: string): Promise<boolean> {
  const res = await ddb.send(
    new GetCommand({
      TableName: table(),
      Key: { pk: `HASH#${hash}`, sk: "META" },
    }),
  );
  return !!res.Item;
}

export async function reserveHash(hash: string, signalId: string): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: table(),
      Item: {
        pk: `HASH#${hash}`,
        sk: "META",
        signalId,
        createdAt: new Date().toISOString(),
      },
      ConditionExpression: "attribute_not_exists(pk)",
    }),
  );
}

export async function putSignal(signal: RapidIqPipelineSignal): Promise<void> {
  const item = {
    ...signal,
    pk: pk(signal.signalId),
    sk: "META",
    gsi1pk: gsi1pk(signal.status),
    gsi1sk: gsi1sk(signal.fitScore, signal.signalDate),
    gsi2pk: `SOURCE#${signal.sourceId}`,
    gsi2sk: signal.signalDate,
  };
  await ddb.send(
    new PutCommand({
      TableName: table(),
      Item: item,
    }),
  );
}

function stripDynamoKeys(obj: Record<string, unknown>): RapidIqPipelineSignal {
  const {
    pk: _pk,
    sk: _sk,
    gsi1pk: _g1,
    gsi1sk: _g1s,
    gsi2pk: _g2,
    gsi2sk: _g2s,
    ...rest
  } = obj;
  void _pk;
  void _sk;
  void _g1;
  void _g1s;
  void _g2;
  void _g2s;
  return rest as RapidIqPipelineSignal;
}

export async function getSignal(signalId: string): Promise<RapidIqPipelineSignal | null> {
  const res = await ddb.send(
    new GetCommand({
      TableName: table(),
      Key: { pk: pk(signalId), sk: "META" },
    }),
  );
  if (!res.Item) return null;
  return stripDynamoKeys(res.Item as Record<string, unknown>);
}

export async function listSignalsByStatus(
  status: RapidIqPipelineSignalStatus,
  limit = 50,
): Promise<RapidIqPipelineSignal[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: table(),
      IndexName: "gsi1-status-score",
      KeyConditionExpression: "gsi1pk = :pk",
      ExpressionAttributeValues: { ":pk": gsi1pk(status) },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return (res.Items ?? []).map((i) => stripDynamoKeys(i as Record<string, unknown>));
}

export async function listAllSignals(limit = 100): Promise<RapidIqPipelineSignal[]> {
  const statuses: RapidIqPipelineSignalStatus[] = ["new", "reviewed", "pushed", "dismissed"];
  const per = Math.max(1, Math.ceil(limit / statuses.length));
  const results = await Promise.all(statuses.map((s) => listSignalsByStatus(s, per)));
  const flat = results.flat();
  flat.sort((a, b) => {
    if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;
    return b.signalDate.localeCompare(a.signalDate);
  });
  return flat.slice(0, limit);
}

export async function updateSignalStatus(
  signalId: string,
  status: RapidIqPipelineSignalStatus,
  extra?: {
    reviewedBy?: string;
    crmLeadId?: string;
  },
): Promise<RapidIqPipelineSignal> {
  const now = new Date().toISOString();
  const current = await getSignal(signalId);
  if (!current) throw new Error(`Signal ${signalId} not found`);

  const names: Record<string, string> = { "#status": "status" };
  const values: Record<string, unknown> = {
    ":status": status,
    ":gsi1pk": gsi1pk(status),
    ":gsi1sk": gsi1sk(current.fitScore, current.signalDate),
    ":now": now,
  };
  let expr =
    "SET #status = :status, gsi1pk = :gsi1pk, gsi1sk = :gsi1sk, reviewedAt = :now";

  if (extra?.reviewedBy) {
    expr += ", reviewedBy = :reviewedBy";
    values[":reviewedBy"] = extra.reviewedBy;
  }
  if (extra?.crmLeadId) {
    expr += ", crmLeadId = :crmLeadId, pushedAt = :pushedAt";
    values[":crmLeadId"] = extra.crmLeadId;
    values[":pushedAt"] = now;
  }

  await ddb.send(
    new UpdateCommand({
      TableName: table(),
      Key: { pk: pk(signalId), sk: "META" },
      UpdateExpression: expr,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );

  const updated = await getSignal(signalId);
  if (!updated) throw new Error(`Signal ${signalId} missing after update`);
  return updated;
}
