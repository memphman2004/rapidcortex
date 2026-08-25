import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { createHash } from "node:crypto";
import type { RapidIqPipelineRawSignal } from "rapid-cortex-shared";
import { isCollectorsMockEnabled } from "../../../lib/rapid-iq/agenda-finder.js";
import { jeffersonCountyMockRawSignal } from "../../../lib/rapid-iq/pipeline/nlp-extract.js";
import { isDuplicateSource } from "../../../lib/rapid-iq/pipeline/ingest-utils.js";

const sqs = new SQSClient({});

/** SQS FIFO MessageDeduplicationId max length. */
export const FIFO_DEDUPE_ID_MAX_LEN = 128;

export function rawSignalsQueueUrl(): string {
  const url = process.env.RAW_SIGNALS_QUEUE_URL?.trim();
  if (!url) throw new Error("RAW_SIGNALS_QUEUE_URL_NOT_CONFIGURED");
  return url;
}

export type EnqueueRawSignalOptions = {
  /** Explicit MessageDeduplicationId (capped at 128). Hashed if omitted. */
  dedupeId?: string;
  /** MessageGroupId — defaults to signal.sourceId. */
  groupId?: string;
};

/** Stable FIFO MessageDeduplicationId ≤ 128 chars (alphanumeric-safe). */
export function fifoDedupeId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return createHash("sha256").update("empty").digest("hex").slice(0, FIFO_DEDUPE_ID_MAX_LEN);
  }
  if (trimmed.length <= FIFO_DEDUPE_ID_MAX_LEN && /^[\w!=.-]+$/.test(trimmed)) {
    return trimmed;
  }
  return createHash("sha256").update(trimmed).digest("hex").slice(0, FIFO_DEDUPE_ID_MAX_LEN);
}

function defaultDedupeKey(signal: RapidIqPipelineRawSignal): string {
  return `${signal.sourceId}|${signal.sourceUrl}|${signal.rawTitle}|${signal.signalDate}`;
}

/**
 * FIFO SQS enqueue — always sets MessageGroupId + MessageDeduplicationId
 * (ContentBasedDeduplication is false on the queue).
 */
export async function enqueueRawSignal(
  signal: RapidIqPipelineRawSignal,
  opts: EnqueueRawSignalOptions = {},
): Promise<boolean> {
  if (await isDuplicateSource(signal.sourceUrl, signal.rawTitle)) {
    console.log(
      JSON.stringify({
        msg: "rapid_iq_ingest_dedup_skip",
        sourceId: signal.sourceId,
        title: signal.rawTitle.slice(0, 80),
      }),
    );
    return false;
  }

  const groupId = (opts.groupId?.trim() || signal.sourceId).slice(0, FIFO_DEDUPE_ID_MAX_LEN);
  const dedupeId = fifoDedupeId(opts.dedupeId?.trim() || defaultDedupeKey(signal));

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: rawSignalsQueueUrl(),
      MessageBody: JSON.stringify(signal),
      MessageGroupId: groupId,
      MessageDeduplicationId: dedupeId,
    }),
  );
  return true;
}

/**
 * When RAPID_IQ_COLLECTORS_MOCK=1, queue a Jefferson County-style sample and skip live APIs.
 * Returns true if mock path was taken.
 */
export async function enqueueMockIfEnabled(
  sourceId: RapidIqPipelineRawSignal["sourceId"],
): Promise<boolean> {
  if (!isCollectorsMockEnabled()) return false;
  const sample = jeffersonCountyMockRawSignal(sourceId);
  await enqueueRawSignal(sample, {
    dedupeId: `mock-${sourceId}-${sample.signalDate}`,
    groupId: sourceId,
  });
  console.log(
    JSON.stringify({
      msg: "rapid_iq_pipeline_mock_enqueued",
      sourceId,
      title: sample.rawTitle.slice(0, 80),
    }),
  );
  return true;
}
