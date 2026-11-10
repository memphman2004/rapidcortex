import type { HourlyBucket, SurgeForecastBucket, SurgeForecastResponse } from "rapid-cortex-shared";

function confidenceFromDays(historyDays: number): SurgeForecastBucket["confidenceLevel"] {
  if (historyDays >= 30) return "high";
  if (historyDays >= 14) return "medium";
  return "low";
}

/**
 * Build a 2-hour × 15-minute surge forecast from existing hourly history buckets.
 * Splits each hour’s average evenly across four 15-minute slots.
 */
export function statisticalSurgeForecast(params: {
  agencyId: string;
  buckets: HourlyBucket[];
  windowMinutes?: number;
  unitsAvailable?: number;
  historyDays: number;
  now?: Date;
}): SurgeForecastResponse {
  const now = params.now ?? new Date();
  const windowMinutes = params.windowMinutes ?? 120;
  const slotCount = Math.max(1, Math.floor(windowMinutes / 15));
  const unitsAvailable = Math.max(1, params.unitsAvailable ?? 4);
  const confidenceLevel = confidenceFromDays(params.historyDays);

  const buckets: SurgeForecastBucket[] = [];
  for (let i = 0; i < slotCount; i += 1) {
    const start = new Date(now.getTime() + i * 15 * 60_000);
    const end = new Date(start.getTime() + 15 * 60_000);
    const hourOfDay = start.getUTCHours();
    const dayOfWeek = start.getUTCDay();
    const match = params.buckets.find(
      (bucket) => bucket.dayOfWeek === dayOfWeek && bucket.hourOfDay === hourOfDay,
    );
    const hourlyAvg = match?.avgCallVolume ?? 0;
    const forecastedCalls = Number((hourlyAvg / 4).toFixed(2));
    const historicalAvg = forecastedCalls;
    const pressureIndex = Math.min(1, forecastedCalls / unitsAvailable);
    buckets.push({
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      forecastedCalls,
      historicalAvg,
      confidenceLevel,
      pressureIndex,
    });
  }

  let consecutiveHigh = 0;
  let staffingAlert = false;
  for (const bucket of buckets) {
    if (bucket.pressureIndex > 0.85) {
      consecutiveHigh += 1;
      if (consecutiveHigh >= 2) {
        staffingAlert = true;
        break;
      }
    } else {
      consecutiveHigh = 0;
    }
  }

  return {
    agencyId: params.agencyId,
    generatedAt: now.toISOString(),
    windowMinutes,
    buckets,
    staffingAlert,
    staffingAlertReason: staffingAlert
      ? "Two or more consecutive 15-minute windows exceed pressure index 0.85"
      : null,
    historyDays: params.historyDays,
    unitsAvailable,
  };
}
