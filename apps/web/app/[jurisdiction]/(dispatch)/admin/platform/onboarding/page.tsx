"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { fetchAgencies } from "@/lib/api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import {
  countOnboardingProgress,
  needsOnboardingAttention,
} from "@/lib/platform-onboarding-helpers";
import type { AgencyTenant } from "rapid-cortex-shared";

export default function PlatformOnboardingPage() {
  const to = useJurisdictionLink();
  const q = useQuery({ queryKey: ["agencies"], queryFn: fetchAgencies });
  const [s, setS] = useState("");

  const rows = useMemo(() => {
    let list = [...(q.data ?? [])];
    const t = s.trim().toLowerCase();
    if (t) {
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(t) ||
          a.agencyId.toLowerCase().includes(t) ||
          a.config.platformOnboarding?.agencyNote?.toLowerCase().includes(t),
      );
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [q.data, s]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Onboarding pipeline</h1>
        <p className="text-sm text-slate-400">
          Checklist is stored in{" "}
          <span className="font-mono text-slate-300">config.platformOnboarding</span> per tenant. Mark
          steps and notes on the agency detail view.
        </p>
      </div>

      <label className="flex max-w-md items-center gap-2 rounded-md border border-slate-800 bg-slate-900/50 px-2 py-1.5">
        <Search className="h-4 w-4 text-slate-500" />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm"
          value={s}
          onChange={(e) => setS(e.target.value)}
          placeholder="Filter by agency or internal note"
        />
      </label>

      {q.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : q.isError ? (
        <p className="text-sm text-rose-300">Failed to load.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-900/90 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2">Agency</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Progress</th>
                <th className="px-2 py-2">Blockers</th>
                <th className="px-2 py-2">Note</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <OnboardingRow key={a.agencyId} a={a} to={to} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OnboardingRow({ a, to }: { a: AgencyTenant; to: (p: string) => string }) {
  const prog = countOnboardingProgress(a.config.platformOnboarding?.steps);
  const att = needsOnboardingAttention(a.status, a.config.platformOnboarding?.steps);
  const note = a.config.platformOnboarding?.agencyNote?.trim();
  return (
    <tr className="border-b border-slate-800/80">
      <td className="px-2 py-2">
        <div className="font-medium text-slate-100">{a.name}</div>
        <div className="font-mono text-[10px] text-slate-500">{a.agencyId}</div>
      </td>
      <td className="px-2 py-2 text-[11px]">
        {a.status}
        {att ? <span className="ml-1 text-amber-300">! needs attention</span> : null}
      </td>
      <td className="px-2 py-2 text-[11px]">
        {prog.complete}/{prog.total}
        {prog.inProgress > 0 ? <span className="text-sky-300"> · {prog.inProgress} in progress</span> : null}
      </td>
      <td className="px-2 py-2 text-[11px] text-rose-200/90">{prog.blocked}</td>
      <td className="max-w-xs truncate px-2 py-2 text-[11px] text-slate-500" title={note ?? ""}>
        {note || "—"}
      </td>
      <td className="px-2 py-2">
        <Link
          className="text-sky-300 hover:underline"
          href={to(`/admin/platform/agencies/${encodeURIComponent(a.agencyId)}`)}
        >
          Open
        </Link>
      </td>
    </tr>
  );
}
