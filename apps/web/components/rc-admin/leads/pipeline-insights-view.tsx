"use client";

import { STAGE_CONFIG, type SalesLeadCrmRecord } from "rapid-cortex-shared";
import { buildPipelineInsight, type PipelineInsight } from "./pipeline-insights";
import { formatCurrency } from "./leads-utils";

type Props = {
  leads: SalesLeadCrmRecord[];
  onSelect: (leadId: string) => void;
};

export function PipelineInsightsView({ leads, onSelect }: Props) {
  const insight = buildPipelineInsight(leads);
  const peak = Math.max(1, ...insight.stageMix.map((row) => row.count));

  return (
    <div className="flex-1 space-y-4 overflow-auto p-5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10">
      <div className="grid gap-3 md:grid-cols-4">
        <Summary label="Open pipeline" value={formatCurrency(insight.openValue)} hint={`${insight.openCount} deals`} />
        <Summary
          label="Weighted forecast"
          value={formatCurrency(insight.weightedOpenValue)}
          hint="Stage chance × value"
        />
        <Summary
          label="Quiet deals"
          value={String(insight.quietCount)}
          hint="No contact in 14 days"
          tone={insight.quietCount > 0 ? "warn" : "ok"}
        />
        <Summary
          label="Missing value"
          value={String(insight.missingValueCount)}
          hint="Qualified or later, no amount"
          tone={insight.missingValueCount > 0 ? "warn" : "ok"}
        />
      </div>

      <section className="rounded-2xl border border-white/[0.06] bg-[#0a1628] p-4">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Where open deals sit</h2>
        <p className="mt-1 text-[11px] text-slate-600">
          Counts are the current stage. This is not a historical conversion rate.
        </p>
        <ul className="mt-4 space-y-2.5">
          {insight.stageMix.map((row) => (
            <li key={row.stage} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3">
              <span className={`text-[11px] font-semibold ${STAGE_CONFIG[row.stage].textClass}`}>{row.label}</span>
              <span className="h-2 overflow-hidden rounded-full bg-white/[0.04]">
                <span
                  className="block h-full rounded-full bg-sky-500/80"
                  style={{ width: `${Math.round((row.count / peak) * 100)}%` }}
                />
              </span>
              <span className="text-right text-[11px] tabular-nums text-slate-400">
                {row.count} · {formatCurrency(row.weighted)} weighted
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <QuietList insight={insight} onSelect={onSelect} />
        <RepList insight={insight} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PilotList insight={insight} onSelect={onSelect} />
        <LossList insight={insight} />
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "warn" | "ok";
}) {
  const color = tone === "warn" ? "text-amber-300" : tone === "ok" ? "text-emerald-300" : "text-slate-100";
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0d1b35] px-4 py-3">
      <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold tabular-nums ${color}`}>{value}</div>
      <div className="mt-1 text-[11px] text-slate-500">{hint}</div>
    </div>
  );
}

function QuietList({ insight, onSelect }: { insight: PipelineInsight; onSelect: (id: string) => void }) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#0a1628] p-4">
      <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Needs a touch</h2>
      {insight.quiet.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No open deal has gone 14 days without contact.</p>
      ) : (
        <ul className="mt-3 divide-y divide-white/[0.04]">
          {insight.quiet.slice(0, 8).map((deal) => (
            <li key={deal.leadId}>
              <button
                type="button"
                onClick={() => onSelect(deal.leadId)}
                className="w-full py-2.5 text-left"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-xs font-semibold text-slate-100">
                    {deal.agency || deal.title}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                    {formatCurrency(deal.value)}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-amber-300/90">{deal.suggestion}</div>
                <div className="mt-0.5 text-[10px] text-slate-600">
                  {STAGE_CONFIG[deal.stage].label}
                  {deal.quietDays == null ? " · never contacted" : ` · ${deal.quietDays}d since contact`}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RepList({ insight }: { insight: PipelineInsight }) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#0a1628] p-4">
      <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Owner workload</h2>
      {insight.reps.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No open deals.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {insight.reps.map((rep) => (
            <li key={rep.name} className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate font-medium text-slate-200">{rep.name}</span>
              <span className="shrink-0 tabular-nums text-slate-400">
                {rep.openCount} open · {formatCurrency(rep.weighted)} weighted
                {rep.quietCount > 0 ? ` · ${rep.quietCount} quiet` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PilotList({ insight, onSelect }: { insight: PipelineInsight; onSelect: (id: string) => void }) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#0a1628] p-4">
      <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Pilots</h2>
      {insight.pilots.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No deal is in Pilot.</p>
      ) : (
        <ul className="mt-3 divide-y divide-white/[0.04]">
          {insight.pilots.map((pilot) => (
            <li key={pilot.leadId}>
              <button type="button" onClick={() => onSelect(pilot.leadId)} className="w-full py-2.5 text-left">
                <div className="flex justify-between gap-3 text-xs">
                  <span className="truncate font-semibold text-slate-100">{pilot.agency || pilot.title}</span>
                  <span className="tabular-nums text-slate-400">{formatCurrency(pilot.value)}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {pilot.start ? `Starts ${pilot.start.slice(0, 10)}` : "Start date not set"}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LossList({ insight }: { insight: PipelineInsight }) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#0a1628] p-4">
      <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Why deals were lost</h2>
      {insight.lossReasons.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No lost deals in this view.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {insight.lossReasons.map((row) => (
            <li key={row.reason} className="flex justify-between text-xs text-slate-300">
              <span>{row.reason}</span>
              <span className="tabular-nums text-slate-500">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
