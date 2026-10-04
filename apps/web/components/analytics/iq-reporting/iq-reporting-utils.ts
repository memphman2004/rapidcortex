import type { IQDailyRecord, IQKPIDefinition } from "@/lib/analytics/iq-reporting-types";

export function formatIQMetric(value: number, format: IQKPIDefinition["format"]): string {
  if (!Number.isFinite(value)) return "—";
  switch (format) {
    case "count":
      return Math.round(value).toLocaleString("en-US");
    case "seconds":
      return `${value.toFixed(1)}s`;
    case "minutes":
      return `${value.toFixed(1)} min`;
    case "percentage":
      return `${value.toFixed(1)}%`;
    case "score":
      return value.toFixed(1);
  }
}

export function aggregateHourlyBuckets(records: IQDailyRecord[]): number[] {
  const sums = Array.from({ length: 24 }, () => 0);
  for (const rec of records) {
    const buckets = rec.hourlyBuckets.length === 24 ? rec.hourlyBuckets : padHourly(rec.hourlyBuckets);
    for (let i = 0; i < 24; i++) {
      sums[i] += buckets[i] ?? 0;
    }
  }
  return sums;
}

function padHourly(input: number[]): number[] {
  const out = Array.from({ length: 24 }, () => 0);
  for (let i = 0; i < Math.min(24, input.length); i++) {
    out[i] = input[i] ?? 0;
  }
  return out;
}

export function sumMetric(records: IQDailyRecord[], key: string): number {
  let total = 0;
  for (const rec of records) {
    const n = rec.metrics[key];
    if (typeof n === "number" && Number.isFinite(n)) total += n;
  }
  return total;
}

export function avgMetric(records: IQDailyRecord[], key: string): number {
  const present = records.filter((r) => typeof r.metrics[key] === "number" && Number.isFinite(r.metrics[key]));
  if (present.length === 0) return 0;
  return sumMetric(present, key) / present.length;
}

export function trendDirection(
  current: number,
  prior: number,
  direction: IQKPIDefinition["direction"],
): "good" | "bad" | "neutral" {
  if (direction === "neutral" || !Number.isFinite(current) || !Number.isFinite(prior) || current === prior) {
    return "neutral";
  }
  const up = current > prior;
  if (direction === "higher-better") return up ? "good" : "bad";
  return up ? "bad" : "good";
}

export function formatTrendLabel(
  current: number,
  prior: number,
  format: IQKPIDefinition["format"],
): string {
  const delta = current - prior;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatIQMetric(delta, format)}`;
}

export function kpiValue(records: IQDailyRecord[], kpi: IQKPIDefinition): number {
  if (kpi.format === "count") return sumMetric(records, kpi.key);
  return avgMetric(records, kpi.key);
}

export function breakdownMetrics(
  records: IQDailyRecord[],
  prefix: string,
  limit = 6,
): { name: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const rec of records) {
    for (const [key, raw] of Object.entries(rec.metrics)) {
      if (!key.startsWith(prefix) || typeof raw !== "number" || !Number.isFinite(raw)) continue;
      totals.set(key, (totals.get(key) ?? 0) + raw);
    }
  }
  return [...totals.entries()]
    .map(([key, value]) => ({ name: key.slice(prefix.length).replace(/_/g, " "), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}
