"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowDownAZ, ArrowUpDown, Building2, Search } from "lucide-react";
import { fetchAgencies } from "@/lib/api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { RC_PLATFORM_COMMAND_PATHS } from "@/lib/platform-command-nav";
import { RcAdminCreateAgencyRunbook } from "@/components/platform/rc-admin-create-agency-runbook";
import { countOnboardingProgress, needsOnboardingAttention } from "@/lib/platform-onboarding-helpers";
import type { AgencyLifecycleStatus, AgencyTenant } from "rapid-cortex-shared";
import { VerticalBadge, deriveVerticalFromAgencyId, normalizeVertical, type Vertical } from "@/components/ui/VerticalBadge";

const statusBadge: Record<AgencyLifecycleStatus, string> = {
  draft: "bg-slate-800 text-slate-200 ring-slate-600",
  pilot: "bg-sky-950/50 text-sky-100 ring-sky-500/30",
  active: "bg-emerald-950/40 text-emerald-100 ring-emerald-500/25",
  suspended: "bg-rose-950/40 text-rose-100 ring-rose-500/30",
  archived: "bg-slate-900 text-slate-500 ring-slate-700",
};

type SortKey = "vertical" | "name" | "status" | "updatedAt" | "type";

function resolveAgencyVertical(agency: AgencyTenant): Vertical {
  const maybe = (agency as AgencyTenant & { vertical?: string }).vertical;
  if (maybe) return normalizeVertical(maybe);
  return deriveVerticalFromAgencyId(agency.agencyId);
}

export default function PlatformAgenciesPage() {
  const pathname = usePathname();
  const to = useJurisdictionLink();
  const newAgencyHref = pathname.startsWith("/rc-admin")
    ? RC_PLATFORM_COMMAND_PATHS.agenciesNew
    : to("/admin/platform/agencies/new");
  const q = useQuery({ queryKey: ["agencies"], queryFn: fetchAgencies });
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("vertical");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const rows = useMemo(() => {
    let list = [...(q.data ?? [])];
    const t = search.trim().toLowerCase();
    if (t) {
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(t) ||
          a.agencyId.toLowerCase().includes(t) ||
          a.state.toLowerCase().includes(t),
      );
    }
    list.sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      if (sortKey === "vertical") {
        const byVertical = resolveAgencyVertical(a).localeCompare(resolveAgencyVertical(b)) * mul;
        if (byVertical !== 0) return byVertical;
        return a.name.localeCompare(b.name) * mul;
      }
      if (sortKey === "name") return a.name.localeCompare(b.name) * mul;
      if (sortKey === "status") return a.status.localeCompare(b.status) * mul;
      if (sortKey === "type") return a.type.localeCompare(b.type) * mul;
      return (a.updatedAt < b.updatedAt ? -1 : 1) * mul;
    });
    return list;
  }, [q.data, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <RcAdminCreateAgencyRunbook />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Agency directory</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-slate-400">
            Cross-tenant registry. Each <span className="font-mono text-slate-300">agencyId</span> is
            a strict data boundary. Municipality admins never see this list.
          </p>
        </div>
        <Link
          href={newAgencyHref}
          className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-rose-900/60 to-slate-800 px-4 py-2 text-sm font-medium text-white ring-1 ring-rose-500/25 hover:from-rose-800/70"
        >
          <Building2 className="mr-1.5 h-4 w-4" />
          New agency
        </Link>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex max-w-md flex-1 items-center gap-2 rounded-md border border-slate-800 bg-slate-900/50 px-3 py-1.5">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600"
            placeholder="Search name, id, or state"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <p className="text-xs text-slate-500">
          {q.isLoading ? "…" : `${rows.length} shown`}
        </p>
      </div>

      {q.isLoading ? (
        <p className="text-sm text-slate-500">Loading agencies…</p>
      ) : q.isError ? (
        <p className="text-sm text-rose-300">
          {q.error instanceof Error ? q.error.message : "Failed to load agencies"}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-900/90 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => toggleSort("name")}
                    className="inline-flex items-center gap-1 font-semibold text-slate-400 hover:text-slate-200"
                  >
                    Agency
                    {sortKey === "name" ? <ArrowUpDown className="h-3 w-3" /> : <ArrowDownAZ className="h-3 w-3 opacity-40" />}
                  </button>
                </th>
                <th className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => toggleSort("vertical")}
                    className="inline-flex items-center gap-1 font-semibold text-slate-400 hover:text-slate-200"
                  >
                    Vertical
                  </button>
                </th>
                <th className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => toggleSort("status")}
                    className="inline-flex items-center gap-1 font-semibold text-slate-400 hover:text-slate-200"
                  >
                    Status
                  </button>
                </th>
                <th className="px-2 py-2">Plan / pilot</th>
                <th className="px-2 py-2">Onboarding</th>
                <th className="px-2 py-2">Integration</th>
                <th className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => toggleSort("updatedAt")}
                    className="font-semibold text-slate-400 hover:text-slate-200"
                  >
                    Last activity
                  </button>
                </th>
                <th className="px-2 py-2 w-8" />
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {rows.map((a) => (
                <AgencyRow key={a.agencyId} a={a} to={to} pathname={pathname} />
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No agencies match this search.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function agencyFeaturesHref(agencyId: string, pathname: string, to: (p: string) => string): string {
  if (pathname.startsWith("/rc-admin")) {
    return `${RC_PLATFORM_COMMAND_PATHS.agencies}/${encodeURIComponent(agencyId)}/features`;
  }
  return to(`/admin/platform/agencies/${encodeURIComponent(agencyId)}`);
}

function agencyBillingHref(agencyId: string, pathname: string, to: (p: string) => string): string {
  if (pathname.startsWith("/rc-admin")) {
    return `${RC_PLATFORM_COMMAND_PATHS.agencies}/${encodeURIComponent(agencyId)}/billing`;
  }
  return to(`/admin/billing/agency/${encodeURIComponent(agencyId)}`);
}

function AgencyRow({
  a,
  to,
  pathname,
}: {
  a: AgencyTenant;
  to: (p: string) => string;
  pathname: string;
}) {
  const prog = countOnboardingProgress(a.config.platformOnboarding?.steps);
  const attention = needsOnboardingAttention(a.status, a.config.platformOnboarding?.steps);
  const plan =
    a.type === "pilot" || a.status === "pilot" ? "Pilot" : a.status === "active" ? "Production" : "Pre-production";
  const vertical = resolveAgencyVertical(a);

  return (
    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
      <td className="px-2 py-2 align-top">
        <div className="font-medium text-slate-100">{a.name}</div>
        <div className="font-mono text-[10px] text-slate-500">{a.agencyId}</div>
        <div className="text-[10px] text-slate-500">
          {a.type} · {a.state}
        </div>
      </td>
      <td className="px-2 py-2 align-top">
        <VerticalBadge vertical={vertical} size="xs" />
      </td>
      <td className="px-2 py-2 align-top">
        <span
          className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ${statusBadge[a.status]}`}
        >
          {a.status}
        </span>
      </td>
      <td className="px-2 py-2 align-top text-[11px] text-slate-400">{plan}</td>
      <td className="px-2 py-2 align-top text-[11px]">
        <span className={attention ? "text-amber-200" : "text-slate-400"}>
          {prog.complete}/{prog.total}
          {prog.blocked > 0 ? ` · ${prog.blocked} blocked` : ""}
        </span>
      </td>
      <td className="px-2 py-2 align-top text-[11px] text-slate-400">
        {a.integrationMode}
        {attention ? " · !" : ""}
      </td>
      <td className="px-2 py-2 align-top font-mono text-[10px] text-slate-500">{a.updatedAt}</td>
      <td className="px-2 py-2 align-top">
        <div className="flex flex-col gap-1 text-left">
          <Link
            href={agencyFeaturesHref(a.agencyId, pathname, to)}
            className="text-sky-300 hover:underline"
          >
            Open
          </Link>
          <Link
            href={agencyBillingHref(a.agencyId, pathname, to)}
            className="text-[10px] text-slate-500 hover:text-slate-300"
          >
            Billing
          </Link>
        </div>
      </td>
    </tr>
  );
}
