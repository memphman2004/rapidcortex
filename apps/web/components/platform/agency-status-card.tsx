"use client";

import Link from "next/link";
import type { AgencyLifecycleStatus } from "rapid-cortex-shared";
import { ExternalLink, AlertCircle } from "lucide-react";
import { VerticalBadge, type Vertical } from "@/components/ui/VerticalBadge";

const statusRing: Record<AgencyLifecycleStatus, string> = {
  draft: "ring-amber-500/30",
  pilot: "ring-sky-500/30",
  active: "ring-emerald-500/25",
  suspended: "ring-rose-500/35",
  archived: "ring-slate-600",
};

export function AgencyStatusCard({
  name,
  agencyId,
  status,
  href,
  sublabel,
  attention,
  vertical,
}: {
  name: string;
  agencyId: string;
  status: AgencyLifecycleStatus;
  href: string;
  sublabel?: string;
  attention?: boolean;
  vertical?: Vertical;
}) {
  return (
    <div
      className={`rounded-lg border border-slate-800 bg-slate-900/50 p-3 ring-1 ${statusRing[status]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{name}</p>
          <p className="mt-0.5 font-mono text-[10px] text-slate-500">{agencyId}</p>
        </div>
        {attention ? (
          <span title="Needs attention" className="shrink-0 text-amber-400">
            <AlertCircle className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
        <span className="rounded bg-slate-950/80 px-1.5 py-0.5 text-slate-200">{status}</span>
        {vertical ? <VerticalBadge vertical={vertical} size="xs" /> : null}
        {sublabel ? <span>{sublabel}</span> : null}
      </div>
      <Link
        href={href}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-sky-300 hover:text-sky-200"
      >
        Open <ExternalLink className="h-3 w-3" aria-hidden />
      </Link>
    </div>
  );
}
