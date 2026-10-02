/**
 * SQS worker: collect watch sources → classify → analyze → DynamoDB upsert.
 * Direct invoke `{ "watchId": "psap-fulton-county-ga" }` is supported for staging verification
 * so we do not have to enqueue the whole watch set.
 */

import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import { rapidIqIntelWatchJobSchema } from "rapid-cortex-shared";
import { processWatch, type ProcessWatchResult } from "../../../lib/rapid-iq/intel-process.js";

export type IntelWatchDirectInvoke = {
  watchId?: string;
  kind?: string;
  dryRun?: boolean;
};

function isSqsEvent(event: SQSEvent | IntelWatchDirectInvoke): event is SQSEvent {
  return Array.isArray((event as SQSEvent).Records);
}

export async function handler(
  event: SQSEvent | IntelWatchDirectInvoke,
): Promise<SQSBatchResponse | ProcessWatchResult> {
  if (isSqsEvent(event)) {
    const failures: string[] = [];
    for (const record of event.Records) {
      try {
        const parsed = rapidIqIntelWatchJobSchema.safeParse(JSON.parse(record.body));
        if (!parsed.success) {
          console.error("Invalid intel watch job", parsed.error.flatten());
          continue;
        }
        await processWatch(parsed.data.watchId);
      } catch (err) {
        console.warn(
          JSON.stringify({
            msg: "rapid_iq_intel_watch_worker_failed",
            error: err instanceof Error ? err.message : String(err),
          }),
        );
        failures.push(record.messageId);
      }
    }
    return { batchItemFailures: failures.map((id) => ({ itemIdentifier: id })) };
  }

  const watchId = event.watchId?.trim();
  if (!watchId) {
    throw new Error("watchId required for direct invoke");
  }
  // dryRun is accepted for checklist payloads; persistence is unchanged.
  // Web search is gated only by OPENAI_WEB_SEARCH_ENABLED + watch.webSearchEnabled.
  return processWatch(watchId);
}
