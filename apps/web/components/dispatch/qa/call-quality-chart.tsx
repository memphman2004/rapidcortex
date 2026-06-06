"use client";

import type { CallQualityTrend, QaScorecardCategory } from "rapid-cortex-shared";
import { QA_SCORECARD_CATEGORY_DEFS } from "rapid-cortex-shared";

function weekLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function LineChart({
  dispatcherSeries,
  agencySeries,
}: {
  dispatcherSeries: CallQualityTrend[];
  agencySeries: CallQualityTrend[];
}) {
  const width = 640;
  const height = 200;
  const pad = { t: 12, r: 12, b: 28, l: 36 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;

  const labels = agencySeries.map((p) => p.periodStart);
  const maxPoints = Math.max(1, labels.length - 1);

  const toX = (i: number) => pad.l + (i / maxPoints) * innerW;
  const toY = (score: number) => pad.t + innerH - (score / 100) * innerH;

  const line = (series: CallQualityTrend[]) =>
    series
      .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(p.avgScore)}`)
      .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Call quality trend">
      {[0, 25, 50, 75, 100].map((tick) => (
        <g key={tick}>
          <line
            x1={pad.l}
            x2={width - pad.r}
            y1={toY(tick)}
            y2={toY(tick)}
            stroke="rgb(51 65 85 / 0.5)"
            strokeWidth={1}
          />
          <text x={4} y={toY(tick) + 4} className="fill-slate-500 text-[10px]">
            {tick}
          </text>
        </g>
      ))}
      {labels.map((iso, i) => (
        <text key={iso} x={toX(i)} y={height - 6} className="fill-slate-500 text-[10px]">
          {weekLabel(iso)}
        </text>
      ))}
      {agencySeries.length > 0 ? (
        <path d={line(agencySeries)} fill="none" stroke="rgb(56 189 248)" strokeWidth={2} opacity={0.85} />
      ) : null}
      {dispatcherSeries.length > 0 ? (
        <path d={line(dispatcherSeries)} fill="none" stroke="rgb(52 211 153)" strokeWidth={2} opacity={0.9} />
      ) : null}
    </svg>
  );
}

function CategoryBars({ breakdown }: { breakdown: Record<QaScorecardCategory, number> }) {
  return (
    <ul className="mt-4 space-y-2">
      {QA_SCORECARD_CATEGORY_DEFS.map((def) => {
        const val = breakdown[def.category] ?? 0;
        return (
          <li key={def.category} className="text-xs">
            <div className="mb-1 flex justify-between text-slate-400">
              <span>{def.label}</span>
              <span className="text-slate-300">{val.toFixed(0)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-slate-800">
              <div className="h-full bg-sky-600/70" style={{ width: `${Math.min(100, val)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function CallQualityChart({
  trends,
  agencyTrends,
}: {
  trends: CallQualityTrend[];
  agencyTrends: CallQualityTrend[];
}) {
  const latest = trends[trends.length - 1] ?? agencyTrends[agencyTrends.length - 1];

  return (
    <section className="rounded-lg border border-slate-700/60 bg-slate-950/80 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-slate-200">Call quality trends</h2>
        <div className="flex gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm bg-emerald-400/80" /> Dispatcher
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm bg-sky-400/80" /> Agency avg
          </span>
        </div>
      </div>
      <LineChart dispatcherSeries={trends} agencySeries={agencyTrends} />
      {latest ? (
        <div className="mt-4 border-t border-slate-800 pt-4">
          <h3 className="text-xs font-medium text-slate-400">Category breakdown (latest period)</h3>
          <CategoryBars breakdown={latest.categoryBreakdown} />
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">No submitted scorecards yet for trend charts.</p>
      )}
    </section>
  );
}
