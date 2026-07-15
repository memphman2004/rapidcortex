"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { SalesLeadStatus } from "rapid-cortex-shared";
import { isSalesLeadsUiEnabled } from "@/lib/runtime-flags";

type LeadRow = {
  leadId: string;
  createdAt: string;
  status?: SalesLeadStatus;
  source?: string;
  email: string;
  name?: string;
  agencyCompany?: string;
};

function displayName(row: LeadRow): string {
  return row.name?.trim() || row.email;
}

/** Compact new-leads inbox strip for RC Admin home dashboards (all RC roles). */
export function RcAdminLeadsPreview() {
  if (!isSalesLeadsUiEnabled()) return null;

  const q = useQuery({
    queryKey: ["rc-admin-leads", "dashboard-preview"],
    queryFn: async () => {
      const res = await fetch("/api/rc-admin/leads?limit=50", { credentials: "include" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return (await res.json()) as { items: LeadRow[] };
    },
    staleTime: 30_000,
  });

  const items = q.data?.items ?? [];
  const newCount = items.filter((row) => (row.status ?? "new") === "new").length;
  const preview = items.slice(0, 5);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Leads</p>
          <p className="text-[11px] text-slate-500">
            {q.isLoading
              ? "Loading…"
              : `${newCount} new · ${items.length} recent`}
          </p>
        </div>
        <Link
          href="/rc-admin/leads"
          className="text-[11px] hover:opacity-90"
          style={{ color: "var(--role-accent, #a78bfa)" }}
        >
          Open inbox →
        </Link>
      </div>
      {q.isError ? (
        <p className="px-4 py-4 text-sm text-rose-300">
          {(q.error as Error).message}
        </p>
      ) : preview.length === 0 && !q.isLoading ? (
        <p className="px-4 py-4 text-sm text-slate-500">No leads yet.</p>
      ) : (
        <ul className="divide-y divide-slate-900/80">
          {preview.map((row) => (
            <li key={row.leadId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium text-slate-200">{displayName(row)}</div>
                <div className="truncate text-[11px] text-slate-500">
                  {row.agencyCompany?.trim() || row.source || row.email}
                </div>
              </div>
              <span className="shrink-0 rounded bg-amber-950/60 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-300">
                {row.status ?? "new"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
