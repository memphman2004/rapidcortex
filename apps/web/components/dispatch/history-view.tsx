"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CategoryBadge, StatusBadge, UrgencyBadge } from "@/components/dispatch/badges";
import { formatRelativeOpened } from "@/lib/format";
import { isApiConfigured } from "@/lib/api";
import { loadIncidents } from "@/lib/queries";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import type { IncidentCategory, IncidentStatus, UrgencyLevel } from "rapid-cortex-shared";

const categories: IncidentCategory[] = [
  "medical",
  "fire",
  "police",
  "welfare_check",
  "domestic_disturbance",
  "unknown",
];
const urgencies: UrgencyLevel[] = ["critical", "high", "moderate", "low"];
const statuses: IncidentStatus[] = [
  "active",
  "in_progress",
  "completed",
  "archived",
];

export function HistoryView() {
  const to = useJurisdictionLink();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<IncidentCategory | "">("");
  const [urgency, setUrgency] = useState<UrgencyLevel | "">("");
  const [status, setStatus] = useState<IncidentStatus | "">("");

  const incidentsQuery = useQuery({
    queryKey: ["incidents"],
    queryFn: loadIncidents,
  });

  const filtered = useMemo(() => {
    let rows = incidentsQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.incidentId.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q),
      );
    }
    if (category) rows = rows.filter((r) => r.category === category);
    if (urgency) rows = rows.filter((r) => r.urgency === urgency);
    if (status) rows = rows.filter((r) => r.status === status);
    return rows;
  }, [incidentsQuery.data, search, category, urgency, status]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden p-4">
      <div className="mb-4 flex flex-col gap-3 border-b border-slate-800 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Incident history</h1>
          <p className="text-sm text-slate-500">
            Review past sessions. Click a row for detail.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID or title…"
            className="min-w-[200px] flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as IncidentCategory | "")}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={urgency}
            onChange={(e) => setUrgency(e.target.value as UrgencyLevel | "")}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200"
          >
            <option value="">All urgency</option>
            {urgencies.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as IncidentStatus | "")}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200"
          >
            <option value="">All status</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-800">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur">
            <tr className="border-b border-slate-800 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Incident</th>
              <th className="px-3 py-2">Opened</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Urgency</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Confidence</th>
              <th className="px-3 py-2">Escalation</th>
            </tr>
          </thead>
          <tbody>
            {incidentsQuery.isLoading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : incidentsQuery.isError ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-rose-300">
                  Could not load incident history.{" "}
                  {incidentsQuery.error instanceof Error ? incidentsQuery.error.message : ""}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  {(incidentsQuery.data?.length ?? 0) === 0
                    ? isApiConfigured()
                      ? "No incidents returned for your agency yet."
                      : "Training mode: sample data only — configure the API for live history."
                    : "No incidents match filters."}
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={row.incidentId}
                  className="border-b border-slate-800/80 hover:bg-slate-900/80"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={to(`/history/${row.incidentId}`)}
                      className="font-mono text-xs text-sky-400 hover:underline"
                    >
                      {row.incidentId}
                    </Link>
                    <div className="mt-0.5 max-w-md truncate text-slate-200">
                      {row.title}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-400">
                    {formatRelativeOpened(row.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <CategoryBadge value={row.category} />
                  </td>
                  <td className="px-3 py-2">
                    <UrgencyBadge value={row.urgency} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge value={row.status} />
                  </td>
                  <td className="px-3 py-2 text-slate-300 tabular-nums">
                    {row.confidence == null ? "—" : `${Math.round(row.confidence * 100)}%`}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {row.escalationFlag ? (
                      <span className="text-red-400">Yes</span>
                    ) : (
                      <span className="text-slate-500">No</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
