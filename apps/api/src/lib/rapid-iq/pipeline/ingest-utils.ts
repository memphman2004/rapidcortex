/**
 * Ingest-time helpers for Rapid IQ pipeline Lambdas.
 * Uses pipelineDdb (not lib/env) so collectors do not require INCIDENTS_TABLE.
 */

import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { createHash } from "node:crypto";
import { pipelineDdb } from "../pipeline-ddb.js";

function signalsTable(): string | null {
  const t = process.env.RAPID_IQ_PIPELINE_SIGNALS_TABLE?.trim();
  return t || null;
}

export function sourceUrlTitleHash(sourceUrl: string, title: string): string {
  return createHash("sha256").update(`${sourceUrl}|${title}`).digest("hex");
}

/**
 * 90-day ingest dedupe. Returns true when this sourceUrl+title was already reserved
 * (caller should skip enqueue). Fails open if the table is unset or Dynamo errors.
 */
export async function isDuplicate(
  signalHash: string,
  ttlDays = 90,
): Promise<boolean> {
  const tableName = signalsTable();
  if (!tableName) return false;

  try {
    const existing = await pipelineDdb.send(
      new GetCommand({
        TableName: tableName,
        Key: { pk: `DEDUP#${signalHash}`, sk: "CHECK" },
      }),
    );
    if (existing.Item) return true;

    await pipelineDdb.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          pk: `DEDUP#${signalHash}`,
          sk: "CHECK",
          ttl: Math.floor(Date.now() / 1000) + ttlDays * 86400,
        },
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );
    return false;
  } catch (err) {
    const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
    if (name === "ConditionalCheckFailedException") return true;
    console.warn(
      JSON.stringify({
        msg: "rapid_iq_ingest_dedup_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return false;
  }
}

export async function isDuplicateSource(sourceUrl: string, title: string): Promise<boolean> {
  return isDuplicate(sourceUrlTitleHash(sourceUrl, title));
}
