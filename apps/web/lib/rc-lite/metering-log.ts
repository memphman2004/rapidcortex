import type { RcLiteUsageRecord } from "rapid-cortex-shared";

/** In-flight buffer for observability; pipe to Dynamo/ClickHouse/Kinesis later. */

const BUFFER_MAX = Number(process.env.RC_LITE_METER_BUFFER ?? 512);
const logs: RcLiteUsageRecord[] = [];

/** Fire-and-forget usage row — never logs raw secrets. */
export async function recordRcLiteUsage(record: RcLiteUsageRecord): Promise<void> {
  logs.push(record);
  if (logs.length > BUFFER_MAX) {
    logs.splice(0, logs.length - BUFFER_MAX);
  }
  if (process.env.NODE_ENV === "development" && process.env.RC_LITE_METER_CONSOLE === "1") {
    console.info("[rc-lite.meter]", record);
  }
}

export function readRcLiteMeterSmokeBuffer(): readonly RcLiteUsageRecord[] {
  return logs;
}

/** Testing hook only — clears the in-process buffer. */
export function clearRcLiteMeterSmokeBuffer(): void {
  logs.length = 0;
}
