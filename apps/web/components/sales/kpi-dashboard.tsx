"use client";

import { useEffect, useMemo, useState } from "react";
import type { SalesLeadCrmRecord } from "rapid-cortex-shared";
import { PIPELINE_STAGES, STAGE_CONFIG } from "rapid-cortex-shared";
import { scoreLead } from "@/lib/sales/lead-scoring";

type Props = { assigneeFilter?: string };

export function KpiDashboard({ assigneeFilter }: Props) {
  const [leads, setLeads] = useState<SalesLeadCrmRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/rc-admin/leads/pipeline", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          leads?: SalesLeadCrmRecord[];
          stages?: Record<string, SalesLeadCrmRecord[]>;
        };
        const flat = data.leads ?? Object.values(data.stages ?? {}).flatMap((x) => x);
        if (!cancelled) setLeads(flat);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scoped = useMemo(
    () =>
      leads.filter((l) =>
        assigneeFilter ? (l.assignedTo ?? l.assignee) === assigneeFilter : true,
      ),
    [leads, assigneeFilter],
  );

  const pipelineValue = scoped.reduce((s, l) => s + (l.estimatedValue ?? 0), 0);
  const weighted = scoped.reduce(
    (s, l) => s + (l.estimatedValue ?? 0) * ((l.probability ?? 0) / 100),
    0,
  );
  const won = scoped.filter((l) => l.pipelineStage === "WON").length;
  const lost = scoped.filter((l) => l.pipelineStage === "LOST").length;
  const conversion = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
  const hot = scoped.filter((l) => scoreLead(l).bucket === "hot").length;

  const byStage = PIPELINE_STAGES.map((stage) => ({
    stage,
    count: scoped.filter((l) => l.pipelineStage === stage).length,
  }));
  const maxCount = Math.max(1, ...byStage.map((s) => s.count));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Pipeline value", value: `$${Math.round(pipelineValue).toLocaleString()}` },
          { label: "Weighted pipeline", value: `$${Math.round(weighted).toLocaleString()}` },
          { label: "Win rate", value: `${conversion}%` },
          { label: "Hot leads", value: String(hot) },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-white/5 bg-[#0a1628] px-4 py-3">
            <div className="text-[10px] font-bold uppercase text-slate-500">{c.label}</div>
            <div className="mt-1 text-xl font-semibold text-white">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/5 bg-[#0a1628] p-4">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Stage funnel</h3>
        <div className="mt-3 space-y-2">
          {byStage.map(({ stage, count }) => (
            <div key={stage} className="flex items-center gap-3">
              <span className={`w-24 text-[11px] ${STAGE_CONFIG[stage].textClass}`}>
                {STAGE_CONFIG[stage].label}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded bg-white/5">
                <div
                  className="h-full rounded bg-sky-500/60"
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right text-[11px] text-slate-400">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
