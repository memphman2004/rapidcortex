"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AgencyTenant } from "rapid-cortex-shared";
import { fetchAdminUsers, fetchAgencies } from "@/lib/api";
import {
  VerticalBadge,
  deriveVerticalFromAgencyId,
  normalizeVertical,
  type TenantVertical,
} from "@/components/dashboards/vertical-badge";
import { isVerticalEnabled } from "@/lib/features";

const VERTICAL_TABS: Array<{ id: "all" | TenantVertical; label: string }> = [
  { id: "all", label: "All" },
  { id: "core", label: "Core" },
  { id: "campus", label: "Campus" },
  { id: "venue", label: "Venue" },
  { id: "hospital", label: "Hospital" },
];

function resolveAgencyVertical(agency: AgencyTenant): TenantVertical {
  const maybe = (agency as AgencyTenant & { vertical?: string }).vertical;
  if (maybe) return normalizeVertical(maybe);
  return deriveVerticalFromAgencyId(agency.agencyId);
}

export function RcAdminAgenciesPageClient() {
  const agenciesQuery = useQuery({ queryKey: ["agencies"], queryFn: fetchAgencies });
  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: fetchAdminUsers });
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const enabledTabs = useMemo(
    () =>
      VERTICAL_TABS.filter((tab) => tab.id === "all" || isVerticalEnabled(tab.id)),
    [],
  );
  const requestedTab = (searchParams.get("vertical") ?? "all").toLowerCase() as "all" | TenantVertical;
  const selectedTab = enabledTabs.some((tab) => tab.id === requestedTab) ? requestedTab : "all";

  const agencies = agenciesQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const sortedAgencies = useMemo(() => {
    return [...agencies].sort((a, b) => {
      const byVertical = resolveAgencyVertical(a).localeCompare(resolveAgencyVertical(b));
      if (byVertical !== 0) return byVertical;
      return a.name.localeCompare(b.name);
    });
  }, [agencies]);
  const verticalCounts = useMemo(() => {
    const counts: Record<"all" | TenantVertical, number> = {
      all: agencies.length,
      core: 0,
      campus: 0,
      venue: 0,
      hospital: 0,
    };
    for (const agency of sortedAgencies) {
      counts[resolveAgencyVertical(agency)] += 1;
    }
    return counts;
  }, [sortedAgencies]);

  const filtered = useMemo(
    () =>
      sortedAgencies.filter((agency) => {
        if (selectedTab === "all") return true;
        return resolveAgencyVertical(agency) === selectedTab;
      }),
    [sortedAgencies, selectedTab],
  );

  const usersByAgency = useMemo(() => {
    const map = new Map<string, number>();
    for (const user of users) {
      map.set(user.agencyId, (map.get(user.agencyId) ?? 0) + 1);
    }
    return map;
  }, [users]);

  function onTabChange(tab: "all" | TenantVertical) {
    const sp = new URLSearchParams(searchParams.toString());
    if (tab === "all") {
      sp.delete("vertical");
    } else {
      sp.set("vertical", tab);
    }
    const qs = sp.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-white">RC Admin Agencies</h1>
        <p className="text-sm text-slate-400">
          Filter by vertical and drill into tenant add-on controls.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Vertical filter">
        {enabledTabs.map((tab) => {
          const selected = selectedTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                selected
                  ? "border-sky-500 bg-sky-900/40 text-sky-100"
                  : "border-slate-700 bg-slate-900/40 text-slate-300 hover:border-slate-500"
              }`}
            >
              {tab.id !== "all" ? <VerticalBadge vertical={tab.id} /> : <span className="font-medium">All</span>}
              <span className="rounded bg-slate-950/70 px-1.5 py-0.5 text-xs">
                {verticalCounts[tab.id]}
              </span>
            </button>
          );
        })}
      </nav>

      {agenciesQuery.isLoading ? <p className="text-sm text-slate-500">Loading agencies…</p> : null}
      {agenciesQuery.isError ? (
        <p className="text-sm text-rose-300">
          {agenciesQuery.error instanceof Error ? agenciesQuery.error.message : "Failed to load agencies"}
        </p>
      ) : null}

      {!agenciesQuery.isLoading && !agenciesQuery.isError ? (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-900/90 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Agency</th>
                <th className="px-3 py-2">Vertical</th>
                <th className="px-3 py-2">Plan tier</th>
                <th className="px-3 py-2">Active users</th>
                <th className="px-3 py-2">Add-ons</th>
                <th className="px-3 py-2">Pilot</th>
                <th className="px-3 py-2">Last active</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {filtered.map((agency) => {
                const vertical = resolveAgencyVertical(agency);
                const tenantFields = agency as AgencyTenant & {
                  planTier?: string;
                  addons?: string[];
                  pilotMode?: boolean;
                };
                const addonCount = tenantFields.addons?.length ?? 0;
                const activeUsers = usersByAgency.get(agency.agencyId) ?? 0;
                const pilot = tenantFields.pilotMode || agency.status === "pilot";
                return (
                  <tr key={agency.agencyId} className="hover:bg-slate-900/40">
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium text-slate-100">{agency.name}</div>
                      <div className="font-mono text-[10px] text-slate-500">{agency.agencyId}</div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <VerticalBadge vertical={vertical} />
                    </td>
                    <td className="px-3 py-2 align-top capitalize text-slate-300">
                      {tenantFields.planTier ?? "starter"}
                    </td>
                    <td className="px-3 py-2 align-top">{activeUsers}</td>
                    <td className="px-3 py-2 align-top">{addonCount}</td>
                    <td className="px-3 py-2 align-top">
                      {pilot ? (
                        <span className="rounded bg-amber-900/40 px-2 py-0.5 text-[10px] text-amber-200">
                          Pilot
                        </span>
                      ) : (
                        <span className="text-slate-500">No</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top font-mono text-[10px] text-slate-500">
                      {agency.updatedAt}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Link
                        href={`/rc-admin/agencies/${encodeURIComponent(agency.agencyId)}/features`}
                        className="text-sky-300 hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500">
                    No agencies match this vertical.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

