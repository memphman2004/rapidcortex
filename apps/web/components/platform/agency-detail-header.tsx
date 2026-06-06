"use client";

import type { AgencyLifecycleStatus, AgencyType } from "rapid-cortex-shared";
import { VerticalBadge, type Vertical } from "@/components/ui/VerticalBadge";

const statusStyle: Record<AgencyLifecycleStatus, string> = {
  draft: "bg-slate-800 text-slate-200 ring-slate-600",
  pilot: "bg-amber-950/60 text-amber-100 ring-amber-500/25",
  active: "bg-emerald-950/50 text-emerald-100 ring-emerald-500/25",
  suspended: "bg-rose-950/40 text-rose-100 ring-rose-500/25",
  archived: "bg-slate-900 text-slate-500 ring-slate-700",
};

export function AgencyDetailHeader({
  name,
  agencyId,
  status,
  type,
  vertical,
  planTier,
}: {
  name: string;
  agencyId: string;
  status: AgencyLifecycleStatus;
  type: AgencyType;
  vertical: Vertical;
  planTier?: string;
}) {
  return (
    <header className="border-b border-slate-800/90 pb-4">
      <p className="font-mono text-xs text-slate-500">{agencyId}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">{name}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ${statusStyle[status]}`}>
          {status}
        </span>
        <VerticalBadge vertical={vertical} size="xs" />
        <span className="text-slate-500">·</span>
        <span className="text-slate-300">{type}</span>
        {planTier ? (
          <>
            <span className="text-slate-500">·</span>
            <span className="capitalize text-slate-300">{planTier}</span>
          </>
        ) : null}
      </div>
    </header>
  );
}
