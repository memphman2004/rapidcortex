"use client";

import { useEffect, useMemo, useState } from "react";
import type { SalesLeadCrmRecord } from "rapid-cortex-shared";
import { STAGE_CONFIG } from "rapid-cortex-shared";
import { isColdLead, scoreLead } from "@/lib/sales/lead-scoring";
import { LeadScoreBadge } from "@/components/sales/lead-score-badge";

type Props = { assigneeFilter?: string };

export function ColdLeadAlerts({ assigneeFilter }: Props) {
  const [leads, setLeads] = useState<SalesLeadCrmRecord[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

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
        const flat =
          data.leads ??
          Object.values(data.stages ?? {}).flatMap((x) => x);
        if (!cancelled) setLeads(flat);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cold = useMemo(() => {
    return leads
      .filter((l) => (assigneeFilter ? (l.assignedTo ?? l.assignee) === assigneeFilter : true))
      .filter((l) => isColdLead(l) && !dismissed.has(l.leadId))
      .slice(0, 8);
  }, [leads, assigneeFilter, dismissed]);

  if (cold.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-amber-300">
          Cold lead alerts
        </h3>
        <span className="text-[11px] text-amber-200/70">{cold.length} need attention</span>
      </div>
      <ul className="mt-2 space-y-2">
        {cold.map((lead) => {
          const score = scoreLead(lead);
          const stage = STAGE_CONFIG[lead.pipelineStage];
          return (
            <li
              key={lead.leadId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-[#080f1e]/60 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm text-white">
                  {lead.agencyName ?? lead.agencyCompany ?? lead.name ?? lead.email}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className={stage?.textClass}>{stage?.label ?? lead.pipelineStage}</span>
                  <LeadScoreBadge score={score} />
                </div>
              </div>
              <button
                type="button"
                className="text-[11px] text-slate-500 hover:text-slate-300"
                onClick={() => setDismissed((prev) => new Set(prev).add(lead.leadId))}
              >
                Dismiss
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
