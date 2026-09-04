/**
 * EventBridge → enqueue enabled Opportunity Intelligence watches (batched via FIFO + reserved concurrency).
 */

import type { ScheduledEvent } from "aws-lambda";
import { env } from "../../../lib/env.js";
import { listIntelWatches, seedDefaultTransitWatches } from "../../../lib/rapid-iq/intel-db.js";
import { enqueueIntelWatchJob } from "../../../lib/rapid-iq/intel-queue.js";

export async function handler(_event: ScheduledEvent): Promise<{ seeded: number; queued: number }> {
  if (!env.enableRapidIqPipeline) {
    return { seeded: 0, queued: 0 };
  }
  const seeded = await seedDefaultTransitWatches();
  const watches = (await listIntelWatches()).filter((w) => w.enabled);
  let queued = 0;
  for (const watch of watches) {
    const ok = await enqueueIntelWatchJob(watch.id);
    if (ok) queued += 1;
  }
  console.log(
    JSON.stringify({
      msg: "rapid_iq_intel_orchestrator",
      seeded,
      queued,
      watches: watches.length,
    }),
  );
  return { seeded, queued };
}
