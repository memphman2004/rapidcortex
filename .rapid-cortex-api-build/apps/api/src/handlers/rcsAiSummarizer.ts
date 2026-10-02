import type { ScheduledHandler } from "aws-lambda";
import { RcsRepository } from "../features/rcs/rcs-repository.js";
import { generateRcsAiSummary, secondsSince } from "../features/rcs/rcs-intelligence.js";
import { publishRcsEvent } from "../features/rcs/rcs-ws.js";
import { env } from "../lib/env.js";

const repo = new RcsRepository();

/**
 * EventBridge every 60s — refresh AI summaries for open RCS calls.
 * Skips calls summarized within the last 55 seconds. Never throws on partial failure.
 */
export const handler: ScheduledHandler = async () => {
  if (!env.enableRcs) {
    console.info(JSON.stringify({ msg: "rcs_ai_summarizer_skipped", reason: "ENABLE_RCS_off" }));
    return;
  }

  let refreshed = 0;
  let skipped = 0;
  let errors = 0;
  let lastKey: Record<string, unknown> | undefined;

  try {
    for (let page = 0; page < 20; page += 1) {
      const { items, lastKey: next } = await repo.scanOpenCalls({
        limit: 25,
        exclusiveStartKey: lastKey,
      });
      lastKey = next;

      for (const call of items) {
        try {
          const age = secondsSince(call.aiSummary?.generatedAt);
          if (call.aiSummary && age < 55) {
            skipped += 1;
            continue;
          }
          const summary = await generateRcsAiSummary(call);
          const now = new Date().toISOString();
          const updated = await repo.updateCallAttributes(call.agencyId, call.callId, {
            aiSummary: summary,
            updatedAt: now,
            ...(call.stateEnteredAt ? {} : { stateEnteredAt: call.createdAt }),
          });
          if (!updated) {
            skipped += 1;
            continue;
          }
          await publishRcsEvent({
            type: "rcs:summary:updated",
            callId: call.callId,
            agencyId: call.agencyId,
            summary,
          });
          refreshed += 1;
        } catch (err) {
          errors += 1;
          console.error(
            JSON.stringify({
              msg: "rcs_ai_summarizer_call_failed",
              callId: call.callId,
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }
      }

      if (!lastKey) break;
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "rcs_ai_summarizer_fatal",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  console.info(
    JSON.stringify({ msg: "rcs_ai_summarizer_done", refreshed, skipped, errors }),
  );
};
