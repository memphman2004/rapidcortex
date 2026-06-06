"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DEFAULT_SLA_THRESHOLDS } from "rapid-cortex-shared/sla-types";
import type { SlaPriority, SlaThreshold } from "rapid-cortex-shared/sla-types";
import { useSession } from "@/components/auth/session-context";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import {
  fetchSlaHistory,
  fetchSlaStatus,
  fetchSlaThresholds,
  isSlaApiConfigured,
  putSlaThresholds,
} from "@/lib/sla-api";
import { isSlaBacklogEnabled } from "@/lib/runtime-flags";

function isAdmin(role: string | undefined): boolean {
  return role === "agencyadmin" || role === "agencyit" || role === "rcsuperadmin";
}

function chartTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function SlaSupervisorPanel() {
  const { user } = useSession();
  const qc = useQueryClient();
  const to = useJurisdictionLink();
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<SlaThreshold[]>(DEFAULT_SLA_THRESHOLDS);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const enabled = isSlaBacklogEnabled() && isSlaApiConfigured();

  const historyQuery = useQuery({
    queryKey: ["sla-history", "24h"],
    queryFn: () => fetchSlaHistory("24h"),
    enabled,
    refetchInterval: 60_000,
  });

  const statusQuery = useQuery({
    queryKey: ["sla-status"],
    queryFn: fetchSlaStatus,
    enabled,
    refetchInterval: 30_000,
  });

  const thresholdsQuery = useQuery({
    queryKey: ["sla-thresholds"],
    queryFn: fetchSlaThresholds,
    enabled: enabled && isAdmin(user?.role),
  });

  const chartData = useMemo(
    () =>
      (historyQuery.data ?? []).map((s) => ({
        time: chartTime(s.snapshotAt),
        queueDepth: s.queueDepth,
        breaches: s.slaBreachCount,
        avgWait: s.avgWaitSeconds,
      })),
    [historyQuery.data],
  );

  const breaches = useMemo(
    () =>
      (statusQuery.data ?? []).filter(
        (s) => s.answerSlaStatus === "breached" || s.dispatchSlaStatus === "breached",
      ),
    [statusQuery.data],
  );

  if (!enabled) return null;

  const openEdit = () => {
    setDraft(thresholdsQuery.data ?? DEFAULT_SLA_THRESHOLDS);
    setSaveError(null);
    setEditOpen(true);
  };

  const saveThresholds = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await putSlaThresholds({ thresholds: draft });
      await qc.invalidateQueries({ queryKey: ["sla-thresholds"] });
      await qc.invalidateQueries({ queryKey: ["sla-status"] });
      await qc.invalidateQueries({ queryKey: ["sla-backlog"] });
      setEditOpen(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = (priority: SlaPriority, field: keyof SlaThreshold, value: number) => {
    setDraft((prev) =>
      prev.map((t) => (t.priority === priority ? { ...t, [field]: value } : t)),
    );
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white">SLA & backlog (24h)</h2>
          <p className="text-xs text-slate-500">Queue depth, wait times, and breach trends.</p>
        </div>
        {isAdmin(user?.role) ? (
          <button
            type="button"
            onClick={openEdit}
            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-sky-300 hover:bg-slate-700"
          >
            Configure thresholds
          </button>
        ) : null}
      </div>

      <div className="h-56 w-full rounded-lg border border-slate-800 bg-slate-950/40 p-2">
        {historyQuery.isLoading ? <p className="p-4 text-xs text-slate-500">Loading trend…</p> : null}
        {chartData.length === 0 && !historyQuery.isLoading ? (
          <p className="p-4 text-xs text-slate-500">No snapshot history yet — data appears as the queue is polled.</p>
        ) : null}
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgb(51 65 85 / 0.4)" strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} width={32} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="queueDepth" name="Queue depth" stroke="#38bdf8" dot={false} />
              <Line type="monotone" dataKey="breaches" name="Breaches" stroke="#f87171" dot={false} />
              <Line type="monotone" dataKey="avgWait" name="Avg wait (s)" stroke="#34d399" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : null}
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Active breaches</h3>
        {statusQuery.isLoading ? <p className="text-xs text-slate-500">Loading…</p> : null}
        {breaches.length === 0 && !statusQuery.isLoading ? (
          <p className="text-xs text-emerald-400/90">No active SLA breaches.</p>
        ) : null}
        <ul className="space-y-1">
          {breaches.map((b) => (
            <li key={b.incidentId} className="flex items-center justify-between gap-2 text-xs">
              <Link
                href={`${to("/incidents")}/${encodeURIComponent(b.incidentId)}`}
                className="font-mono text-sky-300 hover:text-sky-200"
              >
                {b.incidentId}
              </Link>
              <span className="text-slate-400">
                {b.priority} · answer {b.answerSlaStatus} · dispatch {b.dispatchSlaStatus}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {editOpen ? (
        <div className="rounded-lg border border-slate-700 bg-slate-950/80 p-3">
          <h3 className="mb-2 text-xs font-semibold text-white">Agency SLA thresholds</h3>
          <div className="space-y-3">
            {draft.map((t) => (
              <div key={t.priority} className="grid gap-2 sm:grid-cols-4 text-xs">
                <span className="font-semibold text-slate-300">{t.priority}</span>
                <label className="text-slate-400">
                  Answer (s)
                  <input
                    type="number"
                    min={1}
                    value={t.targetAnswerSeconds}
                    onChange={(e) => updateDraft(t.priority, "targetAnswerSeconds", Number(e.target.value))}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
                  />
                </label>
                <label className="text-slate-400">
                  Dispatch (s)
                  <input
                    type="number"
                    min={1}
                    value={t.targetDispatchSeconds}
                    onChange={(e) => updateDraft(t.priority, "targetDispatchSeconds", Number(e.target.value))}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
                  />
                </label>
                <label className="text-slate-400">
                  Warn %
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={t.warningPct}
                    onChange={(e) => updateDraft(t.priority, "warningPct", Number(e.target.value))}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
                  />
                </label>
              </div>
            ))}
          </div>
          {saveError ? <p className="mt-2 text-xs text-rose-300">{saveError}</p> : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveThresholds()}
              className="rounded bg-teal-900/80 px-3 py-1 text-xs text-teal-100 ring-1 ring-teal-700 disabled:opacity-40"
            >
              Save
            </button>
            <button type="button" onClick={() => setEditOpen(false)} className="text-xs text-slate-500">
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
