/**
 * SQS worker: collect watch sources → classify → analyze → DynamoDB upsert.
 */

import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import { rapidIqIntelWatchJobSchema } from "rapid-cortex-shared";
import { processWatch } from "../../../lib/rapid-iq/intel-process.js";

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
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
