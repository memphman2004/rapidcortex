"use client";

import { useMemo, useState } from "react";
import { useAgencyContext } from "@/contexts/agency-context";
import { useRCAdminAgencies } from "@/hooks/use-rc-admin-agencies";
import {
  agencyInitials,
  matchesSwitcherFilter,
  type SwitcherAgency,
  type SwitcherVerticalFilter,
} from "@/lib/agency/switcher-agency";

/**
 * Left-panel agency switcher for RC platform admins on Call Assist.
 *
 * Visible to: rcsuperadmin, rcadmin, rcitadmin only.
 * All | 911 | Campus | Venue is an internal navigation aid — these labels
 * are never shown to customer-facing users.
 */
export function AgencySwitcher() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<SwitcherVerticalFilter>("all");
  const { activeAgencyId, setActiveAgency, isRcAdmin, hydrated } = useAgencyContext();
  const { agencies, isLoading } = useRCAdminAgencies();

  const filtered = useMemo(
    () => agencies.filter((a) => matchesSwitcherFilter(a, filter, search)),
    [agencies, filter, search],
  );

  const activeCount = filtered.filter((a) => a.active).length;

  if (!hydrated || !isRcAdmin) return null;

  function handleKeyDown(e: React.KeyboardEvent, agencyId: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setActiveAgency(agencyId);
    }
  }

  return (
    <aside
      className="flex max-h-[42vh] w-full shrink-0 flex-col border-b border-slate-800 bg-slate-950 md:h-full md:max-h-none md:w-[264px] md:border-b-0 md:border-r"
      aria-label="Agency switcher"
    >
      <div className="border-b border-slate-800 px-3.5 pb-2.5 pt-3.5">
        <p className="mb-2.5 text-[13px] font-medium text-slate-100">Agencies</p>
        <div className="relative">
          <SearchIcon />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ID"
            aria-label="Search agencies"
            className="h-8 w-full rounded-md border border-slate-700 bg-slate-900 py-0 pl-[30px] pr-2.5 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-600"
          />
        </div>
      </div>

      <div
        className="flex flex-wrap gap-1 border-b border-slate-800 px-3.5 py-2"
        role="group"
        aria-label="Filter by type"
      >
        {(["all", "911", "campus", "venue"] as SwitcherVerticalFilter[]).map((v) => (
          <FilterTab
            key={v}
            label={v === "all" ? "All" : v === "911" ? "911" : v.charAt(0).toUpperCase() + v.slice(1)}
            active={filter === v}
            onClick={() => setFilter(v)}
          />
        ))}
      </div>

      <div role="listbox" aria-label="Agency list" className="flex-1 overflow-y-auto px-2 py-1.5">
        {isLoading ? (
          <LoadingSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          filtered.map((agency) => (
            <AgencyRow
              key={agency.agencyId}
              agency={agency}
              isActive={agency.agencyId === activeAgencyId}
              onClick={() => setActiveAgency(agency.agencyId)}
              onKeyDown={(e) => handleKeyDown(e, agency.agencyId)}
            />
          ))
        )}
      </div>

      <div className="border-t border-slate-800 px-3.5 py-2.5">
        <p className="text-[11px] text-slate-500">
          {filtered.length} {filtered.length === 1 ? "agency" : "agencies"} · {activeCount} active
        </p>
      </div>
    </aside>
  );
}

function AgencyRow({
  agency,
  isActive,
  onClick,
  onKeyDown,
}: {
  agency: SwitcherAgency;
  isActive: boolean;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  return (
    <div
      role="option"
      aria-selected={isActive}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={`mb-px flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-[7px] ${
        isActive ? "bg-sky-500/15" : "hover:bg-slate-900"
      }`}
    >
      <div
        className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md border text-[10px] font-medium ${
          isActive
            ? "border-sky-700 bg-sky-700 text-white"
            : "border-slate-700 bg-slate-900 text-slate-400"
        }`}
        aria-hidden="true"
      >
        {agencyInitials(agency.name)}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-[12.5px] font-medium ${isActive ? "text-sky-300" : "text-slate-100"}`}
        >
          {agency.name}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-slate-500">{agency.agencyId}</span>
          <VerticalPill vertical={agency.vertical} />
          <span
            className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full ${agency.active ? "bg-emerald-500" : "bg-slate-600"}`}
            title={agency.active ? "Active" : "Inactive"}
            aria-label={agency.active ? "Active" : "Inactive"}
          />
        </div>
      </div>
    </div>
  );
}

function FilterTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`whitespace-nowrap rounded-md border px-[9px] py-[3px] text-[11px] font-medium ${
        active
          ? "border-sky-600/40 bg-sky-500/15 text-sky-300"
          : "border-slate-700 bg-transparent text-slate-400"
      }`}
    >
      {label}
    </button>
  );
}

function VerticalPill({ vertical }: { vertical: string }) {
  const styles: Record<string, string> = {
    "911": "bg-rose-500/15 text-rose-300",
    campus: "bg-emerald-500/15 text-emerald-300",
    venue: "bg-sky-500/15 text-sky-300",
  };
  const s = styles[vertical];
  if (!s) return null;
  return (
    <span className={`shrink-0 rounded px-1 py-px text-[9.5px] font-medium ${s}`}>
      {vertical === "911" ? "911" : vertical.charAt(0).toUpperCase() + vertical.slice(1)}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pointer-events-none absolute left-[9px] top-1/2 -translate-y-1/2 text-slate-500"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function LoadingSkeleton() {
  return (
    <div className="py-2">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="mb-0.5 h-[46px] rounded-md bg-slate-900"
          style={{ opacity: 1 - i * 0.15 }}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return <div className="px-4 py-8 text-center text-xs text-slate-500">No agencies match</div>;
}
