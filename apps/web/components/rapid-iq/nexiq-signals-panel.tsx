"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NexiqSignalRecord, NexiqSignalVertical } from "rapid-cortex-shared";
import {
  fetchNexiqSignalsSummary,
  listNexiqSignals,
  NEXIQ_SIGNALS_QUERY_KEY,
  NEXIQ_SIGNALS_SUMMARY_QUERY_KEY,
  patchNexiqSignal,
} from "@/lib/nexiq-signals/api";
import { isNexiqSignalsUiEnabled } from "@/lib/runtime-flags";

type VerticalTab = "all" | NexiqSignalVertical;

const VERTICAL_TABS: { id: VerticalTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "core_psap", label: "Core 911" },
  { id: "campus", label: "Campus" },
  { id: "venue", label: "Venue" },
  { id: "transit", label: "Transit" },
];

const TIER_STYLES: Record<string, string> = {
  high: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  medium: "bg-sky-500/15 text-sky-200 border-sky-500/30",
  low: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

const STATUS_DOT: Record<string, string> = {
  new: "bg-emerald-400",
  tracking: "bg-sky-400",
  dismissed: "bg-slate-500",
  pushed_to_crm: "bg-violet-400",
};

function formatMoney(v: number | null | undefined): string | null {
  if (v == null || !Number.isFinite(v)) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
}

export function NexiqSignalsPanel() {
  // Parent /rc-admin/rapid-iq already gates canAccessRapidIqWorkspace (= canAccessNexiqSignals).
  const enabled = isNexiqSignalsUiEnabled();
  const [vertical, setVertical] = useState<VerticalTab>("all");
  const [collapsed, setCollapsed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const qc = useQueryClient();

  const summaryQ = useQuery({
    queryKey: NEXIQ_SIGNALS_SUMMARY_QUERY_KEY,
    queryFn: fetchNexiqSignalsSummary,
    enabled,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });

  const listQ = useQuery({
    queryKey: [...NEXIQ_SIGNALS_QUERY_KEY, vertical],
    queryFn: () =>
      listNexiqSignals({
        status: "new",
        vertical: vertical === "all" ? undefined : vertical,
        limit: 40,
      }),
    enabled,
    staleTime: 30_000,
    retry: 1,
  });

  const mutation = useMutation({
    mutationFn: ({
      signalId,
      action,
    }: {
      signalId: string;
      action: "track" | "dismiss" | "push_to_crm";
    }) => patchNexiqSignal(signalId, action),
    onSuccess: async () => {
      setActionError(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: NEXIQ_SIGNALS_QUERY_KEY }),
        qc.invalidateQueries({ queryKey: NEXIQ_SIGNALS_SUMMARY_QUERY_KEY }),
      ]);
    },
    onError: (err) => {
      setActionError(err instanceof Error ? err.message : "Action failed");
    },
  });

  const items = useMemo(() => listQ.data?.items ?? [], [listQ.data?.items]);
  const summary = summaryQ.data;
  const newCount = summary?.new ?? 0;

  if (!enabled) return null;

  return (
    <section
      id="nexiq-signals"
      className="border-b border-[rgba(255,255,255,0.08)] bg-[#071018] px-4 py-4 sm:px-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-slate-100">
            NexiQ Signals
          </h2>
          {newCount > 0 ? (
            <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-200">
              {newCount} new
            </span>
          ) : null}
          <p className="hidden text-xs text-slate-500 sm:block">
            Civic IQ ingest — not CRM Signal Feed
          </p>
        </div>
        <button
          type="button"
          className="text-xs text-slate-400 hover:text-slate-200 sm:hidden"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </div>

      {collapsed ? null : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "New", value: summary?.new ?? "—" },
              { label: "Tracking", value: summary?.tracking ?? "—" },
              { label: "High tier", value: summary?.high_tier ?? "—" },
              { label: "Pushed to CRM", value: summary?.pushed_to_crm ?? "—" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-white/5 bg-black/20 px-3 py-2"
              >
                <div className="text-[10px] uppercase tracking-wider text-slate-500">
                  {stat.label}
                </div>
                <div className="text-lg font-semibold text-slate-100">{stat.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {VERTICAL_TABS.map((tab) => {
              const active = vertical === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setVertical(tab.id)}
                  className={
                    active
                      ? "rounded-md bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-900"
                      : "rounded-md border border-white/10 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/5"
                  }
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {actionError ? (
            <p className="mt-2 text-xs text-rose-300">{actionError}</p>
          ) : null}

          <div className="mt-3 space-y-2">
            {listQ.isLoading ? (
              <p className="text-xs text-slate-500">Loading signals…</p>
            ) : items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-xs text-slate-500">
                No new NexiQ Signals
                {vertical !== "all" ? ` for ${vertical.replace("_", " ")}` : ""}.
              </p>
            ) : (
              items.map((signal) => (
                <SignalCard
                  key={signal.signalId}
                  signal={signal}
                  busy={
                    mutation.isPending &&
                    mutation.variables?.signalId === signal.signalId
                  }
                  onAction={(action) =>
                    mutation.mutate({ signalId: signal.signalId, action })
                  }
                />
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}

function SignalCard({
  signal,
  busy,
  onAction,
}: {
  signal: NexiqSignalRecord;
  busy: boolean;
  onAction: (action: "track" | "dismiss" | "push_to_crm") => void;
}) {
  const money = formatMoney(signal.estimatedValue);
  const high = signal.confidenceTier === "high";
  return (
    <article
      className={`rounded-lg border border-white/8 bg-[#0b1524] p-3 ${
        high ? "border-l-4 border-l-amber-400" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                TIER_STYLES[signal.confidenceTier] ?? TIER_STYLES.low
              }`}
            >
              {signal.confidenceTier}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
              <span
                className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[signal.status] ?? "bg-slate-500"}`}
              />
              {signal.status.replace(/_/g, " ")}
            </span>
            <span className="text-[10px] text-slate-500">
              {signal.vertical.replace(/_/g, " ")} · {signal.confidenceScore}
            </span>
          </div>
          <h3 className="mt-1 truncate text-sm font-medium text-slate-100">
            {signal.title}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {signal.agencyName}
            {signal.geography?.state ? ` · ${signal.geography.state}` : ""}
            {money ? ` · ${money}` : ""}
          </p>
          {signal.summary ? (
            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{signal.summary}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction("track")}
            className="rounded-md border border-sky-500/40 px-2 py-1 text-[11px] text-sky-200 hover:bg-sky-500/10 disabled:opacity-50"
          >
            Track
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction("dismiss")}
            className="rounded-md border border-white/15 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/5 disabled:opacity-50"
          >
            Dismiss
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction("push_to_crm")}
            className="rounded-md border border-violet-500/40 px-2 py-1 text-[11px] text-violet-200 hover:bg-violet-500/10 disabled:opacity-50"
          >
            Push to CRM
          </button>
        </div>
      </div>
    </article>
  );
}
