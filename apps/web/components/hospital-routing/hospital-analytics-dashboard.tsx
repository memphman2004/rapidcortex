"use client";

import { useCallback, useEffect, useState } from "react";
import type { HospitalDailyMetrics, HospitalPerformanceScore } from "rapid-cortex-shared";

import { fetchHospitalAnalytics, fetchHospitalPerformance } from "@/lib/hospital-routing/api";

export interface HospitalAnalyticsDashboardProps {
  hospitalId: string;
  hospitalName: string;
  days?: number;
}

export function HospitalAnalyticsDashboard({
  hospitalId,
  hospitalName,
  days = 30,
}: HospitalAnalyticsDashboardProps) {
  const [metrics, setMetrics] = useState<HospitalDailyMetrics[]>([]);
  const [performanceScore, setPerformanceScore] = useState<HospitalPerformanceScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const [daily, score] = await Promise.all([
        fetchHospitalAnalytics(hospitalId, days),
        fetchHospitalPerformance(hospitalId, days),
      ]);
      setMetrics(daily);
      setPerformanceScore(score);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [hospitalId, days]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  if (loading) {
    return <div className="p-8 text-white">Loading analytics…</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-red-300">
        {error}
        <button
          type="button"
          onClick={() => void loadAnalytics()}
          className="ml-4 text-sky-400 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const maxEr = Math.max(...metrics.map((m) => m.capacity.avgErBedsAvailable), 1);
  const maxWait = Math.max(...metrics.map((m) => m.wait.avgWaitMinutes), 1);
  const maxDiversion = Math.max(...metrics.map((m) => m.diversion.totalHours), 1);

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-6 space-y-6">
      <header className="rounded-lg bg-slate-900 p-6">
        <h1 className="text-2xl font-bold text-white">{hospitalName} — performance</h1>
        <p className="text-slate-400">Last {days} days</p>
      </header>

      {performanceScore ? (
        <section className="rounded-lg bg-slate-900 p-6">
          <h2 className="mb-4 text-lg font-bold text-white">Overall performance</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <ScoreCard label="Overall" score={performanceScore.scores.overall} trend={performanceScore.trend} />
            <ScoreCard label="Availability" score={performanceScore.scores.availability} />
            <ScoreCard label="Speed" score={performanceScore.scores.speed} />
            <ScoreCard label="Reliability" score={performanceScore.scores.reliability} />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricCard label="Avg daily capacity" value={`${performanceScore.metrics.avgDailyCapacity} beds`} />
            <MetricCard label="Avg wait time" value={`${performanceScore.metrics.avgWaitTime} min`} />
            <MetricCard label="Diversion rate" value={`${performanceScore.metrics.diversionRate}%`} />
            <MetricCard label="Uptime" value={`${performanceScore.metrics.uptimePercent}%`} />
          </div>
        </section>
      ) : null}

      <ChartSection title="Capacity trend (ER beds available)">
        <BarChart
          items={metrics.map((m) => ({
            label: m.date.slice(5),
            value: m.capacity.avgErBedsAvailable,
            max: maxEr,
            color: "bg-emerald-500",
          }))}
          emptyLabel="No daily metrics yet — capacity snapshots will populate history."
        />
      </ChartSection>

      <ChartSection title="Wait time trend (avg minutes)">
        <BarChart
          items={metrics.map((m) => ({
            label: m.date.slice(5),
            value: m.wait.avgWaitMinutes,
            max: maxWait,
            color: "bg-amber-500",
          }))}
          emptyLabel="No wait time history available."
        />
      </ChartSection>

      <ChartSection title="Diversion hours per day">
        <BarChart
          items={metrics.map((m) => ({
            label: m.date.slice(5),
            value: m.diversion.totalHours,
            max: maxDiversion,
            color: "bg-red-500",
          }))}
          emptyLabel="No diversion history recorded."
        />
      </ChartSection>
    </div>
  );
}

function ChartSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg bg-slate-900 p-6">
      <h2 className="mb-4 text-lg font-bold text-white">{title}</h2>
      {children}
    </section>
  );
}

function ScoreCard({
  label,
  score,
  trend,
}: {
  label: string;
  score: number;
  trend?: HospitalPerformanceScore["trend"];
}) {
  const color =
    score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-red-400";
  const trendIcon =
    trend === "IMPROVING" ? "↑" : trend === "DECLINING" ? "↓" : trend === "STABLE" ? "→" : null;

  return (
    <div className="rounded-lg bg-slate-950 p-4">
      <div className="mb-2 text-sm text-slate-400">{label}</div>
      <div className={`flex items-end justify-between text-4xl font-bold ${color}`}>
        {score}
        {trendIcon ? <span className="text-lg text-slate-400">{trendIcon}</span> : null}
      </div>
      <p className="mt-1 text-xs text-slate-500">out of 100</p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-950 p-4">
      <p className="mb-2 text-sm text-slate-400">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function BarChart({
  items,
  emptyLabel,
}: {
  items: Array<{ label: string; value: number; max: number; color: string }>;
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">{emptyLabel}</p>;
  }

  return (
    <div className="flex h-64 items-end gap-1 overflow-x-auto pb-2">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-[28px] flex-1 flex-col items-center gap-1">
          <div
            className={`w-full rounded-t ${item.color}`}
            style={{ height: `${Math.max(4, (item.value / item.max) * 100)}%` }}
            title={`${item.label}: ${item.value}`}
          />
          <span className="text-[10px] text-slate-500">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
