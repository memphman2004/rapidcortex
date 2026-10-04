"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  BarChart2,
  CalendarClock,
  Download,
  FileText,
  Image as ImageIcon,
  Mail,
  RefreshCw,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { canViewIQReporting } from "@/lib/analytics/analytics-authz";
import { IQ_VERTICAL_ACCENT, IQ_VERTICAL_CONFIGS } from "@/lib/analytics/iq-vertical-config";
import type { IQReportingPanelProps, IQTimeRange, IQVertical } from "@/lib/analytics/iq-reporting-types";
import { IQ_VERTICAL_ORDER } from "@/lib/analytics/iq-reporting-types";
import { useIQReportingData } from "./use-iq-reporting-data";
import {
  aggregateHourlyBuckets,
  breakdownMetrics,
  formatIQMetric,
  formatTrendLabel,
  kpiValue,
  trendDirection,
} from "./iq-reporting-utils";

const C = {
  surface: "#100e1a",
  card: "#1a1630",
  border: "#2a2345",
  text: "#e4dff5",
  muted: "#5a4d7a",
  dimText: "#2d2445",
  accent: "#2a78d6",
  red: "#ef4444",
  green: "#22c55e",
  amber: "#f59e0b",
};

const RANGES: { id: IQTimeRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "month", label: "Month" },
  { id: "quarter", label: "Quarter" },
  { id: "year", label: "Year" },
];

const FONT = "Inter, ui-sans-serif, system-ui, sans-serif";

export function IQReportingPanel({
  agencyId,
  vertical: initialVertical,
  user,
}: IQReportingPanelProps) {
  if (!canViewIQReporting(user, agencyId)) return null;

  return (
    <IQReportingPanelInner agencyId={agencyId} vertical={initialVertical} user={user} />
  );
}

function IQReportingPanelInner({
  agencyId,
  vertical: initialVertical,
  user: _user,
}: IQReportingPanelProps) {
  const [activeVertical, setActiveVertical] = useState<IQVertical>(initialVertical);
  const [range, setRange] = useState<IQTimeRange>("month");
  const [publicSafe, setPublicSafe] = useState(false);
  const [compare, setCompare] = useState(false);
  const [exportHint, setExportHint] = useState<string | null>(null);
  const { records, prior, loading, error, refresh } = useIQReportingData(
    agencyId,
    activeVertical,
    range,
    compare,
  );

  const config = IQ_VERTICAL_CONFIGS[activeVertical];
  const accentForVertical = IQ_VERTICAL_ACCENT[activeVertical];
  const kpis = publicSafe ? config.kpis.filter((k) => !k.internalOnly) : config.kpis;

  const hourlyData = useMemo(() => {
    const sums = aggregateHourlyBuckets(records);
    const days = Math.max(1, records.length);
    return sums.map((sum, hour) => ({ hour, value: Number((sum / days).toFixed(2)) }));
  }, [records]);

  const barData = useMemo(
    () => breakdownMetrics(records, config.barBreakdownMetricPrefix),
    [records, config.barBreakdownMetricPrefix],
  );

  return (
    <section style={{ marginTop: 24, fontFamily: FONT, color: C.text }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {IQ_VERTICAL_ORDER.map((id) => {
          const active = id === activeVertical;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveVertical(id)}
              style={{
                ...tabBtn,
                borderColor: active ? IQ_VERTICAL_ACCENT[id] : C.border,
                color: active ? C.text : C.muted,
                background: active ? C.card : "transparent",
              }}
            >
              {IQ_VERTICAL_CONFIGS[id].name}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-start",
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 10,
                letterSpacing: "0.12em",
                fontWeight: 700,
                color: accentForVertical,
                border: `1px solid ${accentForVertical}`,
                borderRadius: 4,
                padding: "2px 6px",
              }}
            >
              {config.badge}
            </span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 650 }}>iQ reporting</h2>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: C.muted }}>
            {config.dashboards}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted }}>
            <input
              type="checkbox"
              checked={publicSafe}
              onChange={(e) => setPublicSafe(e.target.checked)}
            />
            Public-safe
          </label>
          <StubButton icon={<FileText size={13} />} label="PDF" onClick={() => setExportHint("PDF export is not enabled yet.")} />
          <StubButton icon={<ImageIcon size={13} />} label="PNG" onClick={() => setExportHint("PNG export is not enabled yet.")} />
          <StubButton icon={<Mail size={13} />} label="Email" onClick={() => setExportHint("Email send is not enabled yet.")} />
          <StubButton icon={<CalendarClock size={13} />} label="Schedule" onClick={() => setExportHint("Scheduled reports are not enabled yet.")} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRange(r.id)}
            style={{
              ...tabBtn,
              borderColor: range === r.id ? accentForVertical : C.border,
              color: range === r.id ? C.text : C.muted,
            }}
          >
            {r.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCompare((v) => !v)}
          style={{
            ...tabBtn,
            borderColor: compare ? accentForVertical : C.border,
            color: compare ? C.text : C.muted,
          }}
        >
          Compare period
        </button>
        <button type="button" onClick={() => void refresh()} style={tabBtn} aria-label="Refresh">
          <RefreshCw size={13} />
        </button>
      </div>

      {exportHint ? (
        <p style={{ color: C.amber, fontSize: 12, margin: "0 0 12px" }}>{exportHint}</p>
      ) : null}
      {error ? (
        <p style={{ color: C.red, fontSize: 13, margin: "0 0 12px" }}>{error}</p>
      ) : null}
      {loading ? (
        <p style={{ color: C.muted, fontSize: 12, margin: "0 0 12px" }}>Loading metrics…</p>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
          marginBottom: 12,
        }}
      >
        {kpis.map((kpi) => {
          const value = kpiValue(records, kpi);
          const priorValue = kpiValue(prior, kpi);
          const trend =
            compare && prior.length
              ? trendDirection(value, priorValue, kpi.direction)
              : "neutral";
          const color =
            trend === "good" ? C.green : trend === "bad" ? C.red : C.muted;
          return (
            <div key={kpi.key} style={card}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{kpi.label}</div>
              <div style={{ fontSize: 22, fontWeight: 650 }}>{formatIQMetric(value, kpi.format)}</div>
              {compare && prior.length ? (
                <div style={{ fontSize: 11, color, marginTop: 4 }}>
                  {formatTrendLabel(value, priorValue, kpi.format)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {publicSafe ? (
        <div
          style={{
            ...card,
            marginBottom: 12,
            borderColor: C.amber,
            color: C.amber,
            fontSize: 12,
          }}
        >
          Public-safe mode hides internal QA, Clery, MCI, staff-safety, and operator-incident metrics.
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 10,
        }}
      >
        <div style={card}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>{config.lineChartLabel}</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis
                dataKey="hour"
                stroke={C.dimText}
                tick={{ fill: C.muted, fontSize: 10 }}
                interval={3}
                tickFormatter={(h) => `${h}:00`}
              />
              <YAxis stroke={C.dimText} tick={{ fill: C.muted, fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                }}
                labelStyle={{ color: C.muted }}
                itemStyle={{ color: accentForVertical }}
              />
              <Line type="monotone" dataKey="value" stroke={accentForVertical} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
            Top breakdown ({config.barBreakdownMetricPrefix}*)
          </div>
          {barData.length === 0 ? (
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>No breakdown metrics in this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={barData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis type="number" stroke={C.dimText} tick={{ fill: C.muted, fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke={C.dimText}
                  tick={{ fill: C.muted, fontSize: 10 }}
                  width={88}
                />
                <Tooltip
                  contentStyle={{
                    background: C.card,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                  }}
                  labelStyle={{ color: C.muted }}
                  itemStyle={{ color: accentForVertical }}
                />
                <Bar dataKey="value" fill={accentForVertical} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          fontSize: 11,
          color: C.muted,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <BarChart2 size={12} />
        Not shown on dispatcher / call taker workspaces · iQ reporting · NexCort iQ
      </div>
    </section>
  );
}

function StubButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} style={tabBtn}>
      {icon}
      {label}
      <Download size={11} style={{ opacity: 0.5 }} />
    </button>
  );
}

const tabBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 6,
  border: `1px solid ${C.border}`,
  background: C.card,
  color: C.muted,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
};

const card: CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: 12,
};
