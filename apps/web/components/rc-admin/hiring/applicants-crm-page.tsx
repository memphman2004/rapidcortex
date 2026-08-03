"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ATS_STAGES,
  ALL_STAGES,
  STATUS_CONFIG,
  type ApplicationStatus,
  type JobApplication,
} from "rapid-cortex-shared";
import {
  getApplications,
  updateApplicationStatus,
  type ApplicationsData,
} from "@/lib/hiring/applicants-api";
import { ApplicantDetailPanel } from "./applicant-detail-panel";
import { StatusMoveModal, type StatusMoveConfirm } from "./status-move-modal";

const QUERY_KEY = ["rc-admin-applications"] as const;

type ViewMode = "board" | "list";
type SortKey = "name" | "status" | "source" | "experience" | "availability" | "received";

function emptyGroups(): Record<ApplicationStatus, JobApplication[]> {
  return Object.fromEntries(ALL_STAGES.map((s) => [s, [] as JobApplication[]])) as unknown as Record<
    ApplicationStatus,
    JobApplication[]
  >;
}

function matchesSearch(a: JobApplication, q: string) {
  if (!q) return true;
  const lower = q.toLowerCase();
  return (
    `${a.firstName} ${a.lastName}`.toLowerCase().includes(lower) ||
    a.email.toLowerCase().includes(lower) ||
    (a.coverNote ?? "").toLowerCase().includes(lower)
  );
}

function groupApplications(apps: JobApplication[]) {
  const groups = emptyGroups();
  for (const app of apps) {
    groups[app.status] = [...(groups[app.status] ?? []), app];
  }
  return groups;
}

function displayName(a: JobApplication) {
  return `${a.firstName} ${a.lastName}`.trim() || a.email;
}

function shortDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sourceLabel(src: JobApplication["source"]) {
  const map: Record<JobApplication["source"], string> = {
    CAREERS_PAGE: "Website",
    LINKEDIN: "LinkedIn",
    REFERRAL: "Referral",
    INDEED: "Indeed",
    OTHER: "Other",
  };
  return map[src] ?? src;
}

// ─── Board Column ─────────────────────────────────────────────────────────────
function BoardColumn({
  status, apps, selectedId, onSelect, onRequestMove,
}: {
  status: ApplicationStatus;
  apps: JobApplication[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRequestMove: (id: string) => void;
}) {
  const cfg = STATUS_CONFIG[status];
  return (
    <div className="flex w-[220px] shrink-0 flex-col rounded-lg border border-slate-800 bg-[#0a1428]">
      <div className={`flex items-center justify-between border-b ${cfg.boardBorder} px-3 py-2.5`}>
        <span className={`text-[11px] font-bold uppercase tracking-wider ${cfg.textClass}`}>
          {cfg.label}
        </span>
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${cfg.bgClass} ${cfg.textClass}`}>
          {apps.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {apps.map((app) => (
          <button
            key={app.applicationId}
            type="button"
            onClick={() => onSelect(app.applicationId)}
            className={[
              "w-full rounded-md border p-3 text-left transition hover:border-slate-600",
              selectedId === app.applicationId
                ? "border-sky-600 bg-sky-950/40"
                : "border-slate-800 bg-slate-900/40",
            ].join(" ")}
          >
            {/* Rating */}
            {app.rating && (
              <div className="mb-1 text-[10px] text-amber-400">{"★".repeat(app.rating)}{"☆".repeat(5 - app.rating)}</div>
            )}
            <div className="text-xs font-semibold text-slate-100">{displayName(app)}</div>
            <div className="text-[10px] text-slate-500 truncate">{app.email}</div>
            {app.weeklyAvailability && (
              <div className="mt-1.5 text-[10px] text-slate-600">{app.weeklyAvailability} hrs/wk</div>
            )}
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-slate-600">{shortDate(app.createdAt)}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRequestMove(app.applicationId); }}
                className="rounded px-1.5 py-0.5 text-[9px] text-slate-600 hover:bg-slate-800 hover:text-slate-300"
              >
                Move →
              </button>
            </div>
          </button>
        ))}
        {apps.length === 0 && (
          <div className="py-6 text-center text-[11px] text-slate-700">No applicants</div>
        )}
      </div>
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────
function ApplicantListView({
  apps, selectedId, onSelect, sortKey, sortAsc, onSort,
}: {
  apps: JobApplication[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (k: SortKey) => void;
}) {
  const sorted = useMemo(() => {
    return [...apps].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name")         cmp = displayName(a).localeCompare(displayName(b));
      else if (sortKey === "status")  cmp = a.status.localeCompare(b.status);
      else if (sortKey === "source")  cmp = (a.source ?? "").localeCompare(b.source ?? "");
      else if (sortKey === "received")cmp = (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
      else if (sortKey === "experience") cmp = (a.yearsExperience ?? "").localeCompare(b.yearsExperience ?? "");
      return sortAsc ? cmp : -cmp;
    });
  }, [apps, sortKey, sortAsc]);

  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th
      onClick={() => onSort(k)}
      className="cursor-pointer select-none px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500 hover:text-slate-300"
    >
      {children}{sortKey === k ? (sortAsc ? " ↑" : " ↓") : ""}
    </th>
  );

  return (
    <div className="flex-1 overflow-auto p-3.5">
      <table className="w-full min-w-[860px] border-collapse text-left">
        <thead className="sticky top-0 bg-slate-950/95">
          <tr className="border-b border-slate-800">
            <Th k="name">Name / Email</Th>
            <Th k="status">Status</Th>
            <Th k="source">Source</Th>
            <Th k="experience">Experience</Th>
            <Th k="availability">Availability</Th>
            <Th k="received">Received</Th>
            <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Rating</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((app) => {
            const cfg = STATUS_CONFIG[app.status];
            return (
              <tr
                key={app.applicationId}
                onClick={() => onSelect(app.applicationId)}
                className={[
                  "cursor-pointer border-b border-slate-900/80 hover:bg-slate-900/60",
                  selectedId === app.applicationId ? "bg-sky-950/40" : "",
                ].join(" ")}
              >
                <td className="px-3 py-2">
                  <div className="text-xs font-medium text-slate-100">{displayName(app)}</div>
                  <div className="text-[10px] text-slate-500">{app.email}</div>
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${cfg.bgClass} ${cfg.textClass}`}>
                    {cfg.label}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-400">{sourceLabel(app.source)}</td>
                <td className="px-3 py-2 text-xs text-slate-400">{app.yearsExperience ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-slate-400">{app.weeklyAvailability ? `${app.weeklyAvailability} hrs/wk` : "—"}</td>
                <td className="px-3 py-2 text-[11px] text-slate-500">{shortDate(app.createdAt)}</td>
                <td className="px-3 py-2 text-[11px] text-amber-400">
                  {app.rating ? "★".repeat(app.rating) : <span className="text-slate-700">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-600">No applicants match the current filters.</p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function ApplicantsCrmPage() {
  const qc = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<JobApplication["source"] | "all">("all");
  const [view, setView] = useState<ViewMode>("board");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moveModal, setMoveModal] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("received");
  const [sortAsc, setSortAsc] = useState(false);

  const dataQ = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getApplications,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });

  const allApps: JobApplication[] = dataQ.data?.applications ?? [];
  const metrics = dataQ.data?.metrics;

  const filtered = useMemo(() => {
    return allApps.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (sourceFilter !== "all" && a.source !== sourceFilter) return false;
      if (!matchesSearch(a, search)) return false;
      return true;
    });
  }, [allApps, statusFilter, sourceFilter, search]);

  const grouped = useMemo(() => groupApplications(filtered), [filtered]);
  const selected = useMemo(() => allApps.find((a) => a.applicationId === selectedId) ?? null, [allApps, selectedId]);
  const moveTarget = useMemo(() => allApps.find((a) => a.applicationId === moveModal) ?? null, [allApps, moveModal]);

  const patchCache = useCallback((updated: JobApplication) => {
    qc.setQueryData<ApplicationsData>(QUERY_KEY, (prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        applications: prev.applications.map((a) =>
          a.applicationId === updated.applicationId ? updated : a
        ),
      };
    });
  }, [qc]);

  const moveMutation = useMutation({
    mutationFn: ({ id, ...opts }: { id: string } & StatusMoveConfirm) =>
      updateApplicationStatus(id, opts),
    onSuccess: (updated) => {
      patchCache(updated);
      setMoveModal(null);
      setMoveError(null);
      if (selectedId === updated.applicationId) setSelectedId(updated.applicationId);
    },
    onError: (err) => setMoveError(err instanceof Error ? err.message : "Failed to move"),
  });

  function handleSort(k: SortKey) {
    setSortKey(k);
    setSortAsc((prev) => (sortKey === k ? !prev : false));
  }

  return (
    <div className="-mx-1 flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-lg border border-slate-800 bg-[#060c1a]">

      {/* ── Metrics bar ── */}
      <div className="flex flex-wrap items-center gap-0 border-b border-slate-800 bg-[#0c1428] px-4 py-2.5">
        {[
          { v: metrics?.total ?? 0,      label: "TOTAL",       color: "text-sky-400" },
          { v: metrics?.new ?? 0,         label: "NEW",         color: "text-violet-400" },
          { v: metrics?.inProgress ?? 0,  label: "IN PROGRESS", color: "text-amber-400" },
          { v: metrics?.hired ?? 0,        label: "HIRED",       color: "text-emerald-400" },
          { v: metrics?.rejected ?? 0,     label: "REJECTED",    color: "text-red-400" },
        ].map(({ v, label, color }) => (
          <div key={label} className="border-r border-slate-800 px-5 py-1 first:pl-0 last:border-r-0">
            <div className={`text-xl font-bold leading-none ${color}`}>{v}</div>
            <div className="mt-0.5 text-[10px] tracking-wide text-slate-500">{label}</div>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-1 text-center">
            <div className="text-sm font-bold text-emerald-400">{grouped.HIRED?.length ?? 0}</div>
            <div className="text-[9px] tracking-wide text-emerald-300/80">HIRED</div>
          </div>
          <div className="rounded-md border border-red-500/30 bg-red-500/[0.06] px-3 py-1 text-center">
            <div className="text-sm font-bold text-red-400">{grouped.REJECTED?.length ?? 0}</div>
            <div className="text-[9px] tracking-wide text-red-300/80">REJECTED</div>
          </div>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-slate-800 bg-[#0a1428] px-4 py-2">
        <div className="relative max-w-[280px] flex-1">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">🔍</span>
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search applicants, email…"
            className="w-full rounded border border-slate-800 bg-slate-950 py-1.5 pl-7 pr-2 text-xs text-slate-200 outline-none focus:border-sky-500"
          />
        </div>

        {/* Status filter chips */}
        {(["all", ...ATS_STAGES] as (ApplicationStatus | "all")[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={[
              "rounded-full border px-2.5 py-1 text-[11px]",
              statusFilter === s
                ? s === "all"
                  ? "border-sky-500 bg-sky-500/10 text-sky-300"
                  : `${STATUS_CONFIG[s].boardBorder} ${STATUS_CONFIG[s].bgClass} ${STATUS_CONFIG[s].textClass}`
                : "border-slate-800 text-slate-500 hover:border-slate-600",
            ].join(" ")}
          >
            {s === "all" ? "All Stages" : STATUS_CONFIG[s].label}
          </button>
        ))}

        {/* Source filter */}
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as JobApplication["source"] | "all")}
          className="rounded-full border border-slate-800 bg-transparent px-2.5 py-1 text-[11px] text-slate-400"
        >
          <option value="all">All Sources</option>
          <option value="CAREERS_PAGE">Website</option>
          <option value="LINKEDIN">LinkedIn</option>
          <option value="REFERRAL">Referral</option>
          <option value="INDEED">Indeed</option>
          <option value="OTHER">Other</option>
        </select>

        {/* View toggle */}
        <div className="ml-auto flex gap-1">
          {(["board", "list"] as ViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              title={`${v[0].toUpperCase() + v.slice(1)} view`}
              onClick={() => setView(v)}
              className={[
                "rounded border px-2.5 py-1 text-xs",
                view === v ? "border-sky-500 bg-sky-500/15 text-sky-300" : "border-slate-800 text-slate-500",
              ].join(" ")}
            >
              {v === "board" ? "⊞" : "☰"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {dataQ.isLoading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Loading applications…</div>
        ) : dataQ.isError ? (
          <div className="flex flex-1 items-center justify-center text-sm text-red-400">
            {(dataQ.error as Error).message}
          </div>
        ) : allApps.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-slate-500">
            <div className="text-3xl">📋</div>
            <div>
              No applications yet. They will appear here as candidates apply at{" "}
              <span className="text-sky-400">www.rapidcortex.us/careers</span>.
            </div>
          </div>
        ) : view === "board" ? (
          <div className="flex flex-1 items-start gap-2.5 overflow-x-auto p-3.5">
            {ATS_STAGES.map((status) => (
              <BoardColumn
                key={status}
                status={status}
                apps={grouped[status] ?? []}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onRequestMove={(id) => { setMoveError(null); setMoveModal(id); }}
              />
            ))}
          </div>
        ) : (
          <ApplicantListView
            apps={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
            sortKey={sortKey}
            sortAsc={sortAsc}
            onSort={handleSort}
          />
        )}

        {/* Detail panel */}
        {selected && (
          <ApplicantDetailPanel
            application={selected}
            onClose={() => setSelectedId(null)}
            onUpdated={patchCache}
            onOpenMoveModal={() => { setMoveError(null); setMoveModal(selected.applicationId); }}
          />
        )}
      </div>

      {moveModal && moveTarget && (
        <StatusMoveModal
          app={moveTarget}
          busy={moveMutation.isPending}
          error={moveError}
          onClose={() => {
            setMoveModal(null);
            setMoveError(null);
          }}
          onConfirm={(opts) => moveMutation.mutate({ id: moveTarget.applicationId, ...opts })}
        />
      )}
    </div>
  );
}
