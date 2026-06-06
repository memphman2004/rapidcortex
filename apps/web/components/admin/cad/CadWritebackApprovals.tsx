"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CadWritebackAuditRecord } from "rapid-cortex-shared";
import {
  fetchCadWritebackApprovals,
  postCadWritebackApprove,
  postCadWritebackReject,
} from "@/lib/api";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function CadWritebackApprovals() {
  const qc = useQueryClient();
  const [historyTab, setHistoryTab] = useState<"pending" | "history">("pending");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  const pendingQuery = useQuery({
    queryKey: ["cad-writeback-approvals", "pending"],
    queryFn: () => fetchCadWritebackApprovals({ status: "pending_approval" }),
    refetchInterval: 30_000,
  });

  const historyQuery = useQuery({
    queryKey: ["cad-writeback-approvals", "history"],
    queryFn: () => fetchCadWritebackApprovals({ since: "24h" }),
    enabled: historyTab === "history",
    refetchInterval: historyTab === "history" ? 30_000 : false,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => postCadWritebackApprove(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["cad-writeback-approvals"] });
    },
  });

  const rejectMut = useMutation({
    mutationFn: (args: { id: string; notes?: string }) => postCadWritebackReject(args.id, { notes: args.notes }),
    onSuccess: async () => {
      setRejectId(null);
      setRejectNotes("");
      await qc.invalidateQueries({ queryKey: ["cad-writeback-approvals"] });
    },
  });

  const pendingItems = pendingQuery.data?.items ?? [];

  const historyItems = useMemo(() => {
    const rows = historyQuery.data?.items ?? [];
    return [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [historyQuery.data?.items]);

  const parsePayload = useCallback((raw: string): { narrative?: string } => {
    try {
      return JSON.parse(raw) as { narrative?: string };
    } catch {
      return {};
    }
  }, []);

  const rowsToShow = historyTab === "pending" ? pendingItems : historyItems;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-4">
        <button
          type="button"
          onClick={() => setHistoryTab("pending")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            historyTab === "pending" ? "bg-sky-900/50 text-sky-100 ring-1 ring-sky-500/30" : "text-slate-400 hover:text-white"
          }`}
        >
          Pending
          {pendingItems.length > 0 ? (
            <span className="ml-2 rounded-full bg-rose-600/90 px-2 py-0.5 text-[11px] text-white">{pendingItems.length}</span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => setHistoryTab("history")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            historyTab === "history" ? "bg-sky-900/50 text-sky-100 ring-1 ring-sky-500/30" : "text-slate-400 hover:text-white"
          }`}
        >
          Last 24h
        </button>
      </div>

      {pendingQuery.isError || historyQuery.isError ? (
        <p className="text-sm text-rose-300">Failed to load write-back approvals.</p>
      ) : null}

      {historyTab === "pending" && pendingQuery.isLoading ? (
        <p className="text-sm text-slate-500">Loading pending approvals…</p>
      ) : null}
      {historyTab === "history" && historyQuery.isLoading ? (
        <p className="text-sm text-slate-500">Loading history…</p>
      ) : null}

      <ul className="flex flex-col gap-4">
        {rowsToShow.length === 0 && !pendingQuery.isLoading && !(historyTab === "history" && historyQuery.isLoading) ? (
          <li className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">
            No {historyTab === "pending" ? "pending" : "recent"} CAD write-back records.
          </li>
        ) : null}
        {rowsToShow.map((row: CadWritebackAuditRecord) => {
          const payload = parsePayload(row.payload);
          return (
            <li
              key={row.id}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm ring-1 ring-slate-800/60"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-slate-500">{row.id}</p>
                  <p className="mt-1 text-sm text-white">
                    Incident <span className="font-mono text-sky-200/90">{row.incidentId}</span>
                    <span className="mx-2 text-slate-600">·</span>
                    <span className="text-slate-400">{row.cadSystem}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Submitted {formatWhen(row.createdAt)} · {row.userEmail}
                  </p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                  <p className="text-sm text-amber-100/90">{row.status}</p>
                </div>
                {historyTab === "pending" && row.status === "pending_approval" ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={approveMut.isPending}
                      onClick={() => approveMut.mutate(row.id)}
                      className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectId(row.id);
                        setRejectNotes("");
                      }}
                      className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-100 ring-1 ring-slate-600 hover:bg-slate-700"
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>
              {payload.narrative ? (
                <div className="mt-3 rounded-md border border-slate-800/80 bg-slate-950/40 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Narrative</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{payload.narrative}</p>
                </div>
              ) : null}
              {row.errorMessage ? (
                <p className="mt-2 text-xs text-rose-300">{row.errorMessage}</p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {rejectId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-white">Reject write-back</h2>
            <p className="mt-1 text-xs text-slate-500">Optional notes are sent to the submitter via ops notification.</p>
            <textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              rows={4}
              className="mt-3 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="Reason (optional)"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
                onClick={() => setRejectId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectMut.isPending}
                className="rounded-md bg-rose-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-50"
                onClick={() => rejectMut.mutate({ id: rejectId, notes: rejectNotes.trim() || undefined })}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
