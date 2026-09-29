"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  exportVenueIncidentsCsv,
  fetchVenueRfpAnalytics,
  type VenueAnalyticsBundle,
} from "@/lib/venue/venue-rfp-api";

const PIE_COLORS = ["#f59e0b", "#38bdf8", "#34d399", "#f87171", "#a78bfa", "#94a3b8"];

function defaultRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 86400_000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function VenueAnalyticsDashboard({
  venueCode,
  canExport = false,
}: {
  venueCode: string;
  canExport?: boolean;
}) {
  const initial = defaultRange();
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);
  const [data, setData] = useState<VenueAnalyticsBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bundle = await fetchVenueRfpAnalytics(venueCode, startDate, endDate);
      setData(bundle);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analytics unavailable");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [endDate, startDate, venueCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const byTypeChart = useMemo(
    () => Object.entries(data?.byType ?? {}).map(([name, value]) => ({ name, value })),
    [data?.byType],
  );

  const byStatusChart = useMemo(
    () => Object.entries(data?.byStatus ?? {}).map(([name, value]) => ({ name, value })),
    [data?.byStatus],
  );

  async function onExportCsv() {
    try {
      const out = await exportVenueIncidentsCsv(venueCode, startDate, endDate);
      const blob = new Blob([out.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${venueCode}-incidents-${startDate}-${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold" style={{ color: "var(--rc-text-primary)" }}>
          Venue analytics
        </h1>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs" style={{ color: "var(--rc-text-secondary)" }}>
            From
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="ml-1 rounded border px-2 py-1 text-xs"
              style={{ borderColor: "var(--rc-border)", background: "var(--rc-surface-deep)" }}
            />
          </label>
          <label className="text-xs" style={{ color: "var(--rc-text-secondary)" }}>
            To
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="ml-1 rounded border px-2 py-1 text-xs"
              style={{ borderColor: "var(--rc-border)", background: "var(--rc-surface-deep)" }}
            />
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded border px-3 py-1 text-xs font-semibold"
            style={{ borderColor: "var(--rc-border)", color: "var(--rc-amber)" }}
          >
            Refresh
          </button>
          {canExport ? (
            <button
              type="button"
              onClick={() => void onExportCsv()}
              className="rounded border px-3 py-1 text-xs font-semibold"
              style={{ borderColor: "var(--rc-border)", color: "var(--rc-text-primary)" }}
            >
              Export CSV
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm" style={{ color: "var(--rc-amber)" }}>{error}</p> : null}
      {loading ? (
        <p className="text-sm" style={{ color: "var(--rc-text-muted)" }}>Loading analytics…</p>
      ) : data ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Total incidents" value={String(data.total)} />
            <MetricCard
              label="Avg response"
              value={
                data.avgResponseSeconds != null
                  ? `${Math.round(data.avgResponseSeconds / 60)}m`
                  : "—"
              }
            />
            <MetricCard label="Date range" value={`${data.startDate.slice(0, 10)} → ${data.endDate.slice(0, 10)}`} />
          </section>

          <section
            className="grid gap-4 lg:grid-cols-2"
            style={{ minHeight: 280 }}
          >
            <ChartCard title="Incidents by day">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.byDay}>
                  <CartesianGrid stroke="var(--rc-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="var(--rc-text-muted)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--rc-text-muted)" />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="By status">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={byStatusChart} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                    {byStatusChart.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>

          <ChartCard title="By incident type">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byTypeChart}>
                <CartesianGrid stroke="var(--rc-border)" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="var(--rc-text-muted)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--rc-text-muted)" />
                <Tooltip />
                <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: "var(--rc-border)", background: "var(--rc-surface-alt)" }}
    >
      <p className="text-2xl font-bold" style={{ color: "var(--rc-text-primary)" }}>
        {value}
      </p>
      <p className="text-xs" style={{ color: "var(--rc-text-muted)" }}>
        {label}
      </p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: "var(--rc-border)", background: "var(--rc-surface-alt)" }}
    >
      <h2 className="mb-2 text-sm font-semibold" style={{ color: "var(--rc-amber)" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}
