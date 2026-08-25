import type { ScheduledEvent } from "aws-lambda";
import { env } from "../../lib/env.js";
import { seedConferencesIfEmpty } from "../../lib/conferences/seed-conferences.js";
import {
  fetchUpcomingConferences,
  refreshConference,
  sleep,
} from "../../lib/conferences/refresh-conference.js";
import { isCollectorsMockEnabled } from "../../lib/rapid-iq/agenda-finder.js";

export async function handler(
  _event: ScheduledEvent,
): Promise<{ ok: true; checked: number; changed: number; alerted: number }> {
  if (!env.enableConferences) {
    console.log(JSON.stringify({ msg: "conference_refresh_disabled" }));
    return { ok: true, checked: 0, changed: 0, alerted: 0 };
  }

  await seedConferencesIfEmpty();
  const conferences = await fetchUpcomingConferences();
  let changed = 0;
  let alerted = 0;
  const delayMs = isCollectorsMockEnabled() ? 0 : 3000;

  for (let i = 0; i < conferences.length; i += 1) {
    const conf = conferences[i]!;
    try {
      const result = await refreshConference(conf);
      if (result.changes > 0) changed += 1;
      if (result.alerted) alerted += 1;
      if (delayMs > 0 && i < conferences.length - 1) await sleep(delayMs);
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "conference_refresh_item_failed",
          conferenceId: conf.conferenceId,
          name: conf.name,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  console.log(
    JSON.stringify({
      msg: "conference_refresh_complete",
      checked: conferences.length,
      changed,
      alerted,
    }),
  );
  return { ok: true, checked: conferences.length, changed, alerted };
}
