"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { SalesLeadStatus } from "rapid-cortex-shared";

type LeadRow = {
  leadId: string;
  createdAt: string;
  status?: SalesLeadStatus;
  source?: string;
  email: string;
  name?: string;
  phone?: string;
  agencyCompany?: string;
  role?: string;
  customerType?: string;
  interestedIn?: string[];
  estimatedAgencySize?: string;
  message?: string;
  requestedState?: string | null;
  requestedCity?: string | null;
  notes?: string;
  assignee?: string;
  updatedAt?: string;
};

const STATUSES: SalesLeadStatus[] = ["new", "contacted", "qualified", "won", "lost"];

function statusClass(status: SalesLeadStatus): string {
  if (status === "won") return "bg-emerald-950/60 text-emerald-300";
  if (status === "lost") return "bg-red-950/60 text-red-300";
  if (status === "qualified") return "bg-sky-950/60 text-sky-300";
  if (status === "contacted") return "bg-violet-950/60 text-violet-300";
  return "bg-amber-950/60 text-amber-300";
}

function sourceLabel(source?: string): string {
  if (source === "ring-connect-waitlist") return "Ring waitlist";
  if (source === "contact-sales") return "Contact sales";
  return source ?? "Unknown";
}

function displayName(row: LeadRow): string {
  return row.name?.trim() || row.email;
}

function companyLine(row: LeadRow): string {
  if (row.agencyCompany?.trim()) return row.agencyCompany;
  const parts = [row.requestedCity, row.requestedState].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

export function RcAdminLeadsClient() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<SalesLeadStatus | "all">("all");
  const [draftStatus, setDraftStatus] = useState<SalesLeadStatus>("new");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftAssignee, setDraftAssignee] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["rc-admin-leads"],
    queryFn: async () => {
      const res = await fetch("/api/rc-admin/leads", { credentials: "include" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return (await res.json()) as { items: LeadRow[] };
    },
    staleTime: 30_000,
  });

  const items = q.data?.items ?? [];
  const filtered = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((row) => (row.status ?? "new") === statusFilter);
  }, [items, statusFilter]);

  const selected = useMemo(
    () => filtered.find((row) => row.leadId === selectedId) ?? items.find((row) => row.leadId === selectedId) ?? null,
    [filtered, items, selectedId],
  );

  function selectLead(row: LeadRow) {
    setSelectedId(row.leadId);
    setDraftStatus(row.status ?? "new");
    setDraftNotes(row.notes ?? "");
    setDraftAssignee(row.assignee ?? "");
    setSaveMsg(null);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("No lead selected");
      const res = await fetch(`/api/rc-admin/leads/${encodeURIComponent(selectedId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: draftStatus,
          notes: draftNotes,
          assignee: draftAssignee,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return (await res.json()) as { item: LeadRow };
    },
    onSuccess: (data) => {
      setSaveMsg("Saved");
      void qc.invalidateQueries({ queryKey: ["rc-admin-leads"] });
      setDraftStatus(data.item.status ?? "new");
      setDraftNotes(data.item.notes ?? "");
      setDraftAssignee(data.item.assignee ?? "");
    },
    onError: (err) => {
      setSaveMsg((err as Error).message);
    },
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <section className="rounded-lg border border-slate-800 bg-slate-950/50">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Inbox</h2>
            <p className="text-xs text-slate-500">Newest first · {filtered.length} shown</p>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Status
            <select
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as SalesLeadStatus | "all")}
            >
              <option value="all">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        {q.isLoading ? (
          <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>
        ) : q.isError ? (
          <p className="px-4 py-6 text-sm text-red-400">{(q.error as Error).message}</p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No leads yet.</p>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 border-b border-slate-800 bg-slate-950 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Lead</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const status = row.status ?? "new";
                  const active = row.leadId === selectedId;
                  return (
                    <tr
                      key={row.leadId}
                      className={`cursor-pointer border-b border-slate-900/80 hover:bg-slate-900/60 ${
                        active ? "bg-violet-950/30" : ""
                      }`}
                      onClick={() => selectLead(row)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-200">{displayName(row)}</div>
                        <div className="text-[11px] text-slate-500">{companyLine(row)}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{sourceLabel(row.source)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass(status)}`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
        {!selected ? (
          <p className="text-sm text-slate-500">Select a lead to view details and update CRM fields.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-white">{displayName(selected)}</h2>
              <p className="mt-1 text-xs text-slate-500 font-mono">{selected.leadId}</p>
            </div>

            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="text-[11px] uppercase text-slate-500">Email</dt>
                <dd className="text-slate-200">
                  <a className="text-sky-400 hover:underline" href={`mailto:${selected.email}`}>
                    {selected.email}
                  </a>
                </dd>
              </div>
              {selected.phone ? (
                <div>
                  <dt className="text-[11px] uppercase text-slate-500">Phone</dt>
                  <dd className="text-slate-200">{selected.phone}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-[11px] uppercase text-slate-500">Organization / location</dt>
                <dd className="text-slate-200">{companyLine(selected)}</dd>
              </div>
              {selected.role ? (
                <div>
                  <dt className="text-[11px] uppercase text-slate-500">Role</dt>
                  <dd className="text-slate-200">{selected.role}</dd>
                </div>
              ) : null}
              {selected.customerType ? (
                <div>
                  <dt className="text-[11px] uppercase text-slate-500">Customer type</dt>
                  <dd className="text-slate-200">{selected.customerType}</dd>
                </div>
              ) : null}
              {selected.interestedIn?.length ? (
                <div>
                  <dt className="text-[11px] uppercase text-slate-500">Interested in</dt>
                  <dd className="text-slate-200">{selected.interestedIn.join(", ")}</dd>
                </div>
              ) : null}
              {selected.message ? (
                <div>
                  <dt className="text-[11px] uppercase text-slate-500">Message</dt>
                  <dd className="whitespace-pre-wrap text-slate-300">{selected.message}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-[11px] uppercase text-slate-500">Source</dt>
                <dd className="text-slate-200">{sourceLabel(selected.source)}</dd>
              </div>
            </dl>

            <div className="space-y-3 border-t border-slate-800 pt-4">
              <label className="block text-xs text-slate-400">
                Status
                <select
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200"
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value as SalesLeadStatus)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-400">
                Assignee
                <input
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200"
                  value={draftAssignee}
                  onChange={(e) => setDraftAssignee(e.target.value)}
                  placeholder="email or name"
                  maxLength={320}
                />
              </label>
              <label className="block text-xs text-slate-400">
                Notes
                <textarea
                  className="mt-1 min-h-[120px] w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-200"
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  maxLength={8000}
                />
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded bg-violet-700 px-3 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50"
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  {saveMutation.isPending ? "Saving…" : "Save"}
                </button>
                {saveMsg ? (
                  <span
                    className={`text-xs ${saveMutation.isError ? "text-red-400" : "text-emerald-400"}`}
                  >
                    {saveMsg}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
