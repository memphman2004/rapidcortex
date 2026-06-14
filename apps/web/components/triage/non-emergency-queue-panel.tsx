"use client";

import { useState } from "react";
import type { TriageQueueItem } from "rapid-cortex-shared/triage";
import { useTriagePolling } from "./use-triage-polling";
import { postTriageEscalation, patchTriageQueueItem } from "@/lib/api";

function waitTime(queuedAt: string): string {
  const ms = Date.now() - new Date(queuedAt).getTime();
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function confidenceTone(c: number): string {
  if (c >= 85) return "text-emerald-300 border-emerald-500/30 bg-emerald-500/10";
  if (c >= 70) return "text-amber-300 border-amber-500/30 bg-amber-500/10";
  return "text-red-300 border-red-500/30 bg-red-500/10";
}

function QueueRow({
  item,
  onAction,
}: {
  item: TriageQueueItem;
  onAction: (incidentId: string, action: "claim" | "release" | "close" | "escalate") => void;
}) {
  return (
    <div
      className={`rounded-lg border border-slate-800 bg-slate-950/60 p-3 ${
        item.status === "IN_PROGRESS" ? "border-l-sky-500" : "border-l-amber-500"
      } border-l-[3px]`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] font-bold text-slate-400">
              {item.incidentId.slice(-8).toUpperCase()}
            </span>
            <span
              className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${confidenceTone(item.confidence)}`}
            >
              {item.confidence}% conf
            </span>
            <span
              className={`text-[9px] font-semibold uppercase ${
                item.status === "IN_PROGRESS" ? "text-sky-300" : "text-amber-300"
              }`}
            >
              {item.status.replace("_", " ")}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-100">{item.suggestedCategory}</p>
          <p className="text-[10px] text-slate-500">
            Waiting: {waitTime(item.queuedAt)}
            {item.assignedTo ? ` · Assigned: ${item.assignedTo}` : ""}
          </p>
          {item.transcriptSummary ? (
            <p className="mt-1 truncate text-[10px] text-slate-500" title={item.transcriptSummary}>
              “{item.transcriptSummary}”
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          {item.status === "PENDING" ? (
            <ActionBtn tone="sky" onClick={() => onAction(item.incidentId, "claim")}>
              Claim
            </ActionBtn>
          ) : null}
          {item.status === "IN_PROGRESS" ? (
            <>
              <ActionBtn tone="muted" onClick={() => onAction(item.incidentId, "release")}>
                Release
              </ActionBtn>
              <ActionBtn tone="green" onClick={() => onAction(item.incidentId, "close")}>
                Close
              </ActionBtn>
            </>
          ) : null}
          <ActionBtn tone="red" onClick={() => onAction(item.incidentId, "escalate")}>
            Escalate
          </ActionBtn>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  children,
  tone,
  onClick,
}: {
  children: React.ReactNode;
  tone: "sky" | "muted" | "green" | "red";
  onClick: () => void;
}) {
  const toneClass =
    tone === "sky"
      ? "border-sky-500/40 text-sky-300 hover:bg-sky-500/10"
      : tone === "green"
        ? "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
        : tone === "red"
          ? "border-red-500/40 text-red-300 hover:bg-red-500/10"
          : "border-slate-600 text-slate-300 hover:bg-slate-800";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${toneClass}`}
    >
      {children}
    </button>
  );
}

export function NonEmergencyQueuePanel({ enabled }: { enabled: boolean }) {
  const { items, count, isLoading, isError, mutate } = useTriagePolling(enabled);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!enabled) return null;

  const handleAction = async (
    incidentId: string,
    action: "claim" | "release" | "close" | "escalate",
  ) => {
    setActionError(null);
    try {
      if (action === "escalate") {
        await postTriageEscalation({ incidentId, reason: "Supervisor escalation from queue" });
      } else {
        const statusMap = {
          claim: "IN_PROGRESS",
          release: "PENDING",
          close: "CLOSED",
        } as const;
        await patchTriageQueueItem(incidentId, { status: statusMap[action] });
      }
      await mutate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    }
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Non-emergency queue</h2>
          <p className="text-[11px] text-slate-500">AI-routed calls awaiting supervisor or dispatcher handling.</p>
        </div>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-200">
          {count}
        </span>
      </div>

      {actionError ? <p className="mb-2 text-xs text-red-300">{actionError}</p> : null}
      {isLoading ? <p className="text-xs text-slate-500">Loading queue…</p> : null}
      {isError ? <p className="text-xs text-red-300">Could not load queue.</p> : null}
      {!isLoading && !isError && items.length === 0 ? (
        <p className="text-xs text-slate-500">No pending non-emergency calls.</p>
      ) : null}

      <div className="space-y-2">
        {items.map((item) => (
          <QueueRow key={item.sk} item={item} onAction={(id, act) => void handleAction(id, act)} />
        ))}
      </div>
    </section>
  );
}
