import type { ScheduledHandler } from "aws-lambda";
import {
  listAgencyIdsFromSnapshots,
  writeDailySnapshot,
} from "../../comms-intel/command-service.js";

export const handler: ScheduledHandler = async () => {
  const agencies = await listAgencyIdsFromSnapshots();
  if (!agencies.length) {
    console.info("daily-metrics: no ACTIVE_AGENCY_IDS configured; skipping");
    return;
  }
  const date = new Date().toISOString().slice(0, 10);
  for (const agencyId of agencies) {
    try {
      await writeDailySnapshot(agencyId, date);
    } catch (e) {
      console.warn("daily-metrics agency failed", {
        agencyId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
};
