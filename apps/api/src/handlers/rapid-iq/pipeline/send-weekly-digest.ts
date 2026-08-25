import type { ScheduledEvent } from "aws-lambda";
import { sendWeeklyDigest } from "../../../lib/rapid-iq/pipeline/send-alerts.js";

export async function handler(_event: ScheduledEvent): Promise<{ ok: true; sent: boolean }> {
  const result = await sendWeeklyDigest();
  return { ok: true, ...result };
}
