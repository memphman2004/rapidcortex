import { describe, expect, it } from "vitest";
import {
  aggregateHourlyBuckets,
  avgMetric,
  formatIQMetric,
  formatTrendLabel,
  sumMetric,
  trendDirection,
} from "@/components/analytics/iq-reporting/iq-reporting-utils";
import type { IQDailyRecord } from "./iq-reporting-types";

function rec(metrics: Record<string, number>, hourly?: number[]): IQDailyRecord {
  return {
    agencyId: "a",
    vertical: "911",
    date: "2026-10-01",
    metrics,
    hourlyBuckets: hourly ?? Array.from({ length: 24 }, () => 0),
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

describe("iq-reporting-utils", () => {
  it("formats metric kinds", () => {
    expect(formatIQMetric(4847, "count")).toBe("4,847");
    expect(formatIQMetric(8.2, "seconds")).toBe("8.2s");
    expect(formatIQMetric(4.2, "minutes")).toBe("4.2 min");
    expect(formatIQMetric(87.4, "score")).toBe("87.4");
    expect(formatIQMetric(2.1, "percentage")).toBe("2.1%");
  });

  it("sums and averages metrics", () => {
    const rows = [rec({ calls_911: 10, avg_qa_score: 80 }), rec({ calls_911: 5, avg_qa_score: 90 })];
    expect(sumMetric(rows, "calls_911")).toBe(15);
    expect(avgMetric(rows, "avg_qa_score")).toBe(85);
  });

  it("aggregates hourly buckets", () => {
    const a = rec({}, Array.from({ length: 24 }, (_, i) => (i === 8 ? 2 : 0)));
    const b = rec({}, Array.from({ length: 24 }, (_, i) => (i === 8 ? 3 : 0)));
    expect(aggregateHourlyBuckets([a, b])[8]).toBe(5);
  });

  it("colors trends from direction", () => {
    expect(trendDirection(10, 8, "higher-better")).toBe("good");
    expect(trendDirection(10, 8, "lower-better")).toBe("bad");
    expect(trendDirection(10, 10, "higher-better")).toBe("neutral");
    expect(formatTrendLabel(12, 10, "count")).toBe("+2");
  });
});
