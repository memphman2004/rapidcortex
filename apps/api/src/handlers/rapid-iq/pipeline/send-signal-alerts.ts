import type { ScheduledEvent } from "aws-lambda";
import { sendHighIntentAlerts } from "../../../lib/rapid-iq/pipeline/send-alerts.js";

export async function handler(_event: ScheduledEvent): Promise<{ ok: true; candidates: number; sent: boolean }> {
  const result = await sendHighIntentAlerts();
  return { ok: true, ...result };
}
