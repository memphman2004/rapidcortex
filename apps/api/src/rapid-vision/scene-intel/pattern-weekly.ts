import type { ScheduledHandler } from "aws-lambda";
import { env } from "../../lib/env.js";
import { visionStore } from "../store.js";
import { summarizeSceneWeek } from "./scene-claude-roles.js";

/**
 * Weekly note for each configured scene-intelligence agency.
 * Opus recommends a threshold change. This job does not apply it.
 */
export const handler: ScheduledHandler = async () => {
  if (!env.enableRapidVisionSceneIntel || !env.enableVisionAiClaude) return;
  const agencyIds = env.visionSceneIntelAgencyIds;
  for (const agencyId of agencyIds) {
    try {
      const rows = await visionStore.listSceneAlerts(agencyId, { status: "all", limit: 100 });
      const note = await summarizeSceneWeek(rows);
      console.info(
        JSON.stringify({
          msg: "vision_scene_weekly_pattern",
          agencyId,
          alerts: rows.length,
          summary: note?.summary ?? null,
          thresholdNote: note?.thresholdNote ?? null,
          applied: false,
        }),
      );
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "vision_scene_weekly_pattern_failed",
          agencyId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
};
