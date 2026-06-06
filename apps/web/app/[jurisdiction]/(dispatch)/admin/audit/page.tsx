"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { isApiConfigured } from "@/lib/api";
import { loadAuditEvents } from "@/lib/queries";

function summarizeDetails(details: Record<string, unknown> | undefined): string {
  if (!details || Object.keys(details).length === 0) return "—";
  try {
    const s = JSON.stringify(details);
    return s.length > 120 ? `${s.slice(0, 117)}…` : s;
  } catch {
    return "—";
  }
}

export default function AdminAuditPage() {
  const auditQuery = useQuery({
    queryKey: ["audit-events", "admin", 80],
    queryFn: () => loadAuditEvents(80),
  });

  const items = useMemo(() => auditQuery.data ?? [], [auditQuery.data]);

  const downloadJson = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      source: "GET /api/audit/events",
      limit: 80,
      items,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-events-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [items]);

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Audit log</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Newest-first operational events for your agency from{" "}
            <code className="rounded bg-slate-900 px-1 text-slate-200">GET /api/audit/events</code>{" "}
            (incidents, transcripts, analyses, admin actions as emitted by the API). Requires a configured
            API and <span className="font-mono text-slate-300">admin</span> (or equivalent) role.
          </p>
        </div>
        <div className="shrink-0">
          <button
            type="button"
            onClick={downloadJson}
            disabled={!isApiConfigured() || items.length === 0 || auditQuery.isLoading}
            className="rounded-md border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Download visible (JSON)
          </button>
          <p className="mt-1 max-w-[200px] text-[10px] leading-snug text-slate-500">
            Exports the same rows loaded in this browser session (agency-scoped). Redact before sharing
            externally.
          </p>
        </div>
      </div>
      {!isApiConfigured() ? (
        <p className="mt-6 text-sm text-amber-200/90">
          API not configured — connect the app to your deployed API to load audit entries.
        </p>
      ) : null}
      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-800">
        <table className="min-w-full text-left text-xs text-slate-300">
          <thead className="border-b border-slate-800 bg-slate-900/80 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Resource</th>
              <th className="px-3 py-2 font-medium">Incident</th>
              <th className="px-3 py-2 font-medium">Actor</th>
              <th className="px-3 py-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {auditQuery.isLoading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : auditQuery.isError ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-rose-300">
                  Could not load audit events.{" "}
                  {auditQuery.error instanceof Error ? auditQuery.error.message : ""}
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  No audit events returned.
                </td>
              </tr>
            ) : (
              items.map((a) => (
                <tr key={a.eventId} className="border-b border-slate-800/80 hover:bg-slate-900/40">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                    {new Date(a.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-200">{a.type}</td>
                  <td className="max-w-[140px] truncate px-3 py-2 font-mono text-slate-500" title={a.resourceId}>
                    {a.resourceType ? `${a.resourceType}` : "—"}
                    {a.resourceId ? ` · ${a.resourceId}` : ""}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-400">
                    {a.incidentId ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-500">{a.actorId ?? "—"}</td>
                  <td
                    className="max-w-xs truncate px-3 py-2 font-mono text-[10px] text-slate-500"
                    title={summarizeDetails(a.details as Record<string, unknown>)}
                  >
                    {summarizeDetails(a.details as Record<string, unknown>)}
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
