import type { HourlyBucket } from "rapid-cortex-shared";
import type { Incident } from "rapid-cortex-shared";
import { IncidentRepository } from "../../repositories/incidentRepository.js";

const incidentRepo = new IncidentRepository();

const MS_PER_DAY = 86_400_000;

function hourAndDow(iso: string): { hourOfDay: number; dayOfWeek: number } {
  const d = new Date(iso);
  return { hourOfDay: d.getUTCHours(), dayOfWeek: d.getUTCDay() };
}

function bucketKey(hourOfDay: number, dayOfWeek: number): string {
  return `${dayOfWeek}:${hourOfDay}`;
}

export type AggregateCallVolumeResult = {
  buckets: HourlyBucket[];
  dataQualityNote: string | null;
  incidentCount: number;
  lookbackDays: number;
};

/** Paginate incidents for lookback window and group by hour-of-day + day-of-week. */
export async function aggregateCallVolumeHistory(
  agencyId: string,
  lookbackDays = 90,
): Promise<AggregateCallVolumeResult> {
  const since = new Date(Date.now() - lookbackDays * MS_PER_DAY).toISOString();
  const incidents: Incident[] = [];
  let cursor: string | undefined;
  const pageSize = 500;

  do {
    const page = await incidentRepo.listByAgencySincePaginated(agencyId, since, pageSize, cursor);
    incidents.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);

  const counts = new Map<string, number[]>();

  for (const inc of incidents) {
    const ts = inc.createdAt;
    if (!ts) continue;
    const { hourOfDay, dayOfWeek } = hourAndDow(ts);
    const key = bucketKey(hourOfDay, dayOfWeek);
    const list = counts.get(key) ?? [];
    list.push(1);
    counts.set(key, list);
  }

  const buckets: HourlyBucket[] = [];
  for (const [key, weekSamples] of counts) {
    const [dowStr, hourStr] = key.split(":");
    const dayOfWeek = Number(dowStr);
    const hourOfDay = Number(hourStr);
    const total = weekSamples.reduce((a, b) => a + b, 0);
    const sampleCount = Math.max(1, Math.ceil(lookbackDays / 7));
    const avgCallVolume = total / sampleCount;
    const sorted = [...weekSamples].sort((a, b) => a - b);
    const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    const p95CallVolume = sorted[p95Idx] ?? avgCallVolume;
    buckets.push({
      hourOfDay,
      dayOfWeek,
      avgCallVolume: Math.round(avgCallVolume * 100) / 100,
      p95CallVolume: Math.round(p95CallVolume * 100) / 100,
      sampleCount,
    });
  }

  buckets.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.hourOfDay - b.hourOfDay);

  const weeksOfData = incidents.length > 0 ? Math.min(lookbackDays / 7, lookbackDays / 7) : 0;
  let dataQualityNote: string | null = null;
  if (incidents.length < 20) {
    dataQualityNote = "Limited incident history (< 20 calls). Forecast confidence is low.";
  } else if (weeksOfData < 4) {
    dataQualityNote = "Less than four weeks of data available. Patterns may not be reliable yet.";
  }

  return {
    buckets,
    dataQualityNote,
    incidentCount: incidents.length,
    lookbackDays,
  };
}
