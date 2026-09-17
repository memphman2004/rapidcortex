"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserContext } from "rapid-cortex-shared/types";
import type { SopLibraryDocument } from "rapid-cortex-shared";
import { useAgencyWebSocket } from "@/hooks/use-agency-websocket";
import {
  actOnSopPending,
  fetchSopIntelligenceSnapshot,
  saveSopLibraryStep,
  submitSopPhase2,
  type SopIntelPendingItem,
  type SopIntelSnapshot,
} from "@/lib/sop-intelligence/api";

type InnerView =
  | "drift"
  | "review"
  | "pending"
  | "form"
  | "library"
  | "coaching";

const TABS: Array<{ id: InnerView; label: string }> = [
  { id: "drift", label: "SOP Drift" },
  { id: "review", label: "Call Review" },
  { id: "pending", label: "Pending Updates" },
  { id: "form", label: "Discrepancy Form" },
  { id: "library", label: "SOP Library" },
  { id: "coaching", label: "Coaching" },
];

function barColor(count: number, max: number): string {
  const pct = max <= 0 ? 0 : count / max;
  if (pct >= 0.75) return "bg-rose-500";
  if (pct >= 0.5) return "bg-orange-400";
  if (pct >= 0.3) return "bg-amber-400";
  return "bg-emerald-500";
}

function levelClass(level?: string): string {
  if (level === "HIGH") return "text-rose-400";
  if (level === "MED") return "text-amber-300";
  return "text-slate-400";
}

export function SopIntelligenceDashboard({
  user,
  agencyName,
  displayName,
}: {
  user: UserContext;
  agencyName: string;
  displayName: string;
}) {
  const qc = useQueryClient();
  const [view, setView] = useState<InnerView>("drift");
  const [banner, setBanner] = useState<string | null>(null);

  const snapshotQ = useQuery({
    queryKey: ["sop-intelligence", "snapshot"],
    queryFn: fetchSopIntelligenceSnapshot,
    refetchInterval: 8000,
  });

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["sop-intelligence"] });
  }, [qc]);

  useAgencyWebSocket(
    (message) => {
      if (!message.type.startsWith("sop-intel.")) return;
      if (message.type === "sop-intel.suggestion.created") {
        const sopId = String(message.data.sopId ?? "");
        setBanner(`Pattern threshold reached on SOP ${sopId}. Claude suggestion is ready in Pending Updates.`);
        setView("pending");
      }
      refresh();
    },
    { enabled: true },
  );

  const data = snapshotQ.data;
  const pendingCount = data?.pending.filter((p) => p.status === "pending").length ?? 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0b1018] text-slate-200">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-400">
            RC SOP Intelligence — Supervisor Dashboard
          </p>
          <p className="mt-0.5 text-sm text-slate-400">{agencyName}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {pendingCount > 0 ? (
            <span className="rounded-full bg-amber-500/15 px-3 py-1 font-medium text-amber-300 ring-1 ring-amber-500/30">
              {pendingCount} pending SOP update{pendingCount === 1 ? "" : "s"}
            </span>
          ) : null}
          <span>{displayName}</span>
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-sky-300">
            {user.role}
          </span>
        </div>
      </header>

      <div className="flex min-h-[640px]">
        <aside className="w-56 shrink-0 border-r border-slate-800 bg-[#0d1420] px-3 py-4">
          <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Operations</p>
          <InnerNavButton active={view === "drift"} label="SOP Intelligence" count={pendingCount} onClick={() => setView("drift")} />
          <InnerNavButton active={view === "form"} label="Discrepancy Reports" onClick={() => setView("form")} />
          <p className="mt-5 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Workforce</p>
          <InnerNavButton active={view === "coaching"} label="Coaching Queue" count={data?.coaching.length} onClick={() => setView("coaching")} />
          <InnerNavButton active={view === "library"} label="SOP Library" onClick={() => setView("library")} />
          <div className="mt-8 px-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Pattern stats</p>
            <ul className="mt-2 space-y-1 text-[11px] text-slate-400">
              {(data?.patterns ?? []).slice(0, 6).map((p) => (
                <li key={`${p.sopId}-${p.stepId}`} className="flex justify-between">
                  <span>
                    SOP {p.sopId} {p.stepId}
                  </span>
                  <span className="font-mono text-slate-200">{p.gapCount}</span>
                </li>
              ))}
              {data && data.patterns.length === 0 ? <li>No SOP-gap patterns yet</li> : null}
            </ul>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-6 py-5">
          <div className="mb-5 flex flex-wrap gap-1 border-b border-slate-800 pb-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={`rounded-t px-3 py-1.5 text-sm ${
                  view === tab.id
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.label}
                {tab.id === "pending" && pendingCount > 0 ? (
                  <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 text-[10px] text-amber-300">
                    {pendingCount}
                  </span>
                ) : null}
                {tab.id === "coaching" && (data?.coaching.length ?? 0) > 0 ? (
                  <span className="ml-1.5 rounded-full bg-sky-500/20 px-1.5 text-[10px] text-sky-300">
                    {data?.coaching.length}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {banner ? (
            <div className="mb-4 flex items-start justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              <p>{banner}</p>
              <button type="button" className="text-amber-300" onClick={() => setBanner(null)}>
                Dismiss
              </button>
            </div>
          ) : null}

          {snapshotQ.isLoading ? (
            <p className="text-sm text-slate-500">Loading SOP Intelligence…</p>
          ) : snapshotQ.error ? (
            <p className="text-sm text-rose-400">{(snapshotQ.error as Error).message}</p>
          ) : data ? (
            <>
              {view === "drift" ? <DriftView data={data} /> : null}
              {view === "review" ? <ReviewView data={data} /> : null}
              {view === "pending" ? <PendingView data={data} onDone={refresh} /> : null}
              {view === "form" ? <DiscrepancyForm library={data.library} onDone={refresh} /> : null}
              {view === "library" ? <LibraryView library={data.library} onDone={refresh} /> : null}
              {view === "coaching" ? <CoachingView data={data} /> : null}
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function InnerNavButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mt-1 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${
        active ? "bg-sky-900/50 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
      }`}
    >
      <span>{label}</span>
      {count ? (
        <span className="rounded-full bg-sky-500/20 px-1.5 text-[10px] text-sky-300">{count}</span>
      ) : null}
    </button>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#121a26] px-4 py-4">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function DriftView({ data }: { data: SopIntelSnapshot }) {
  const max = Math.max(1, ...data.patterns.map((p) => p.gapCount));
  return (
    <div>
      <p className="mb-4 text-xs text-slate-500">
        Transcript analysis · deviation tracking · auto-suggested SOP updates
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Calls analyzed this shift" value={String(data.kpis.callsAnalyzed)} />
        <Kpi label="Calls with SOP deviations" value={String(data.kpis.callsWithGaps)} />
        <Kpi label="SOP updates pending review" value={String(data.kpis.pendingUpdates)} />
        <Kpi
          label="Deviation rate"
          value={`${data.kpis.deviationRate}%`}
          hint={data.kpis.callsAnalyzed ? `from ${data.kpis.callsAnalyzed} reports` : "no reports yet"}
        />
      </div>
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">SOPs by deviation frequency — last 7 days</h2>
        </div>
        <ul className="space-y-3">
          {data.patterns.length === 0 ? (
            <li className="text-sm text-slate-500">No SOP-gap patterns yet. Submit a Phase 2 discrepancy with “SOP gap identified”.</li>
          ) : (
            data.patterns.map((p) => (
              <li key={`${p.sopId}-${p.stepId}`}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>
                    {p.sopId} — {p.title}
                  </span>
                  <span className="text-xs text-slate-500">
                    {p.gapCount} call{p.gapCount === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-slate-800">
                  <div
                    className={`h-full ${barColor(p.gapCount, max)}`}
                    style={{ width: `${Math.max(8, (p.gapCount / max) * 100)}%` }}
                  />
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Recent deviations</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="py-2">Call ID</th>
              <th>Time</th>
              <th>Telecom</th>
              <th>SOP</th>
              <th>Level</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.reports.filter((r) => r.sopGapIdentified).slice(0, 12).map((r) => (
              <tr key={r.reportId} className="border-t border-slate-800">
                <td className="py-2 font-mono text-sky-300">{r.callId}</td>
                <td className="text-slate-400">{new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                <td>{r.telecom || r.dispatcherName || "—"}</td>
                <td>
                  {r.sopId} {r.stepId}
                </td>
                <td className={levelClass(r.level)}>{r.level ?? "—"}</td>
                <td className="text-amber-300">{r.resolutionStatus ?? "Needs review"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReviewView({ data }: { data: SopIntelSnapshot }) {
  const [selectedId, setSelectedId] = useState(data.reports[0]?.reportId ?? "");
  const selected = data.reports.find((r) => r.reportId === selectedId) ?? data.reports[0];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-800 bg-[#121a26]">
        <p className="border-b border-slate-800 px-4 py-2 text-xs uppercase tracking-wider text-slate-500">
          Calls with SOP notes
        </p>
        <ul>
          {data.reports.slice(0, 20).map((r) => (
            <li key={r.reportId}>
              <button
                type="button"
                onClick={() => setSelectedId(r.reportId)}
                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${
                  selected?.reportId === r.reportId ? "bg-sky-950/40" : "hover:bg-slate-800/40"
                }`}
              >
                <span className="font-mono text-sky-300">{r.callId}</span>
                <span className="text-slate-500">{r.sopId ?? "no gap"}</span>
              </button>
            </li>
          ))}
          {data.reports.length === 0 ? (
            <li className="px-4 py-6 text-sm text-slate-500">No discrepancy reports yet.</li>
          ) : null}
        </ul>
      </div>
      <div className="rounded-xl border border-slate-800 bg-[#121a26] p-4">
        {selected ? (
          <>
            <p className="text-xs uppercase tracking-wider text-slate-500">Narrative</p>
            <p className="mt-2 text-sm leading-6 text-slate-200">{selected.whatHappened}</p>
            {selected.gapDescription ? (
              <p className="mt-4 rounded bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
                SOP gap: {selected.gapDescription}
              </p>
            ) : null}
            {selected.actionTaken ? (
              <p className="mt-3 text-sm text-slate-400">Action taken: {selected.actionTaken}</p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-slate-500">Select a call.</p>
        )}
      </div>
    </div>
  );
}

function PendingView({ data, onDone }: { data: SopIntelSnapshot; onDone: () => void }) {
  const pending = data.pending.filter((p) => p.status === "pending" || p.status === "deferred");
  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "defer" | "dismiss" }) =>
      actOnSopPending(id, action),
    onSuccess: onDone,
  });
  if (pending.length === 0) {
    return <p className="text-sm text-slate-500">No pending SOP language updates. Pattern threshold is {data.threshold} reports.</p>;
  }
  return (
    <div className="space-y-4">
      {pending.map((item) => (
        <PendingCard
          key={item.updateId}
          item={item}
          busy={mutation.isPending}
          onAction={(action) => mutation.mutate({ id: item.updateId, action })}
        />
      ))}
      {mutation.error ? <p className="text-sm text-rose-400">{(mutation.error as Error).message}</p> : null}
    </div>
  );
}

function PendingCard({
  item,
  busy,
  onAction,
}: {
  item: SopIntelPendingItem;
  busy: boolean;
  onAction: (action: "approve" | "defer" | "dismiss") => void;
}) {
  return (
    <article className="rounded-xl border border-slate-800 bg-[#121a26] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">
            {item.sopId} — {item.sopTitle}
          </p>
          <p className="text-xs text-slate-500">
            Step {item.stepId} · {item.evidenceCount} reports · confidence {Math.round(item.confidence * 100)}%
          </p>
        </div>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-300">
          {item.status}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Current language</p>
          <p className="mt-1 text-sm text-slate-400">{item.currentLang}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-sky-400">Suggested language</p>
          <p className="mt-1 text-sm text-slate-100">{item.suggestedLang}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">{item.rationale}</p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction("approve")}
          className="rounded-md bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-500 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction("defer")}
          className="rounded-md bg-slate-700 px-3 py-1.5 text-sm text-slate-200 disabled:opacity-50"
        >
          Defer 7 days
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction("dismiss")}
          className="rounded-md px-3 py-1.5 text-sm text-slate-400 hover:text-rose-300 disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
    </article>
  );
}

function DiscrepancyForm({
  library,
  onDone,
}: {
  library: SopLibraryDocument[];
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<1 | 2>(2);
  const [callId, setCallId] = useState("");
  const [dispatcherName, setDispatcherName] = useState("");
  const [whatHappened, setWhatHappened] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [gap, setGap] = useState(false);
  const [sopId, setSopId] = useState(library[0]?.sopId ?? "");
  const [stepId, setStepId] = useState(library[0]?.steps[0]?.stepId ?? "");
  const [gapDescription, setGapDescription] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const selected = library.find((s) => s.sopId === sopId) ?? library[0];

  const mutation = useMutation({
    mutationFn: () =>
      submitSopPhase2({
        callId,
        dispatcherName: dispatcherName || undefined,
        telecom: dispatcherName || undefined,
        whatHappened,
        actionTaken: actionTaken || undefined,
        sopGapIdentified: gap,
        sopId: gap ? sopId : undefined,
        stepId: gap ? stepId : undefined,
        gapDescription: gap ? gapDescription || undefined : undefined,
        rootCause: rootCause || undefined,
      }),
    onSuccess: (out) => {
      setMessage(
        out.thresholdReached
          ? `Submitted. Pattern count ${out.pattern?.gapCount} — suggestion pipeline fired.`
          : out.pattern
            ? `Submitted. Pattern count for ${out.pattern.sopId} ${out.pattern.stepId} is now ${out.pattern.gapCount}.`
            : "Submitted.",
      );
      setCallId("");
      setWhatHappened("");
      setActionTaken("");
      setGapDescription("");
      onDone();
    },
  });

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setPhase(1)}
          className={`rounded-md px-3 py-1.5 text-sm ${phase === 1 ? "bg-slate-700 text-white" : "text-slate-400"}`}
        >
          Phase 1 — Telecom
        </button>
        <button
          type="button"
          onClick={() => setPhase(2)}
          className={`rounded-md px-3 py-1.5 text-sm ${phase === 2 ? "bg-slate-700 text-white" : "text-slate-400"}`}
        >
          Phase 2 — Technical
        </button>
      </div>
      {phase === 1 ? (
        <p className="text-sm text-slate-400">
          Phase 1 is what was on screen, what the caller said, and what action was taken. No ESN, no LEC, no
          legacy fields. Continue to Phase 2 to file the SOP-gap flag that feeds the pattern pipeline.
        </p>
      ) : null}
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <label className="block text-sm">
          Call ID
          <input
            required
            value={callId}
            onChange={(e) => setCallId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            placeholder="BC-2026-091604"
          />
        </label>
        <label className="block text-sm">
          Dispatcher / telecom
          <input
            value={dispatcherName}
            onChange={(e) => setDispatcherName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            placeholder="T. Washington"
          />
        </label>
        <label className="block text-sm">
          What happened
          <textarea
            required
            value={whatHappened}
            onChange={(e) => setWhatHappened(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
            rows={3}
          />
        </label>
        {phase === 2 ? (
          <>
            <label className="block text-sm">
              Action taken
              <textarea
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
                rows={2}
              />
            </label>
            <fieldset className="text-sm">
              <legend className="mb-1">SOP gap identified?</legend>
              <label className="mr-4">
                <input type="radio" checked={gap} onChange={() => setGap(true)} /> Yes
              </label>
              <label>
                <input type="radio" checked={!gap} onChange={() => setGap(false)} /> No
              </label>
            </fieldset>
            {gap ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  SOP
                  <select
                    value={sopId}
                    onChange={(e) => {
                      setSopId(e.target.value);
                      const next = library.find((s) => s.sopId === e.target.value);
                      setStepId(next?.steps[0]?.stepId ?? "");
                    }}
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
                  >
                    {library.map((s) => (
                      <option key={s.sopId} value={s.sopId}>
                        {s.sopId} — {s.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Step
                  <select
                    value={stepId}
                    onChange={(e) => setStepId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
                  >
                    {(selected?.steps ?? []).map((s) => (
                      <option key={s.stepId} value={s.stepId}>
                        {s.stepNumber} — {s.text.slice(0, 48)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm md:col-span-2">
                  Gap description
                  <textarea
                    value={gapDescription}
                    onChange={(e) => setGapDescription(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
                    rows={2}
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  Root cause / GIS / vendor notes
                  <input
                    value={rootCause}
                    onChange={(e) => setRootCause(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
                  />
                </label>
              </div>
            ) : null}
          </>
        ) : null}
        <button
          type="submit"
          disabled={mutation.isPending || phase === 1}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {phase === 1 ? "Continue to Phase 2 to submit" : mutation.isPending ? "Submitting…" : "Submit Phase 2"}
        </button>
        {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
        {mutation.error ? <p className="text-sm text-rose-400">{(mutation.error as Error).message}</p> : null}
      </form>
    </div>
  );
}

function LibraryView({ library, onDone }: { library: SopLibraryDocument[]; onDone: () => void }) {
  const [selectedId, setSelectedId] = useState(library[0]?.sopId ?? "");
  const selected = library.find((s) => s.sopId === selectedId) ?? library[0];
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const mutation = useMutation({
    mutationFn: ({ sopId, stepId, text }: { sopId: string; stepId: string; text: string }) =>
      saveSopLibraryStep(sopId, stepId, text),
    onSuccess: onDone,
  });

  const steps = selected?.steps ?? [];
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <ul className="rounded-xl border border-slate-800 bg-[#121a26]">
        {library.map((s) => (
          <li key={s.sopId}>
            <button
              type="button"
              onClick={() => {
                setSelectedId(s.sopId);
                setDrafts({});
              }}
              className={`w-full px-3 py-2 text-left text-sm ${
                selected?.sopId === s.sopId ? "bg-sky-950/50 text-white" : "text-slate-400 hover:bg-slate-800/40"
              }`}
            >
              <span className="font-mono text-sky-300">{s.sopId}</span>
              <span className="mt-0.5 block text-xs">{s.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {selected ? (
        <div className="rounded-xl border border-slate-800 bg-[#121a26] p-4">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-white">{selected.title}</h2>
            <p className="text-xs text-slate-500">v{selected.version}</p>
          </div>
          <div className="space-y-4">
            {steps.map((step) => {
              const value = drafts[step.stepId] ?? step.text;
              const dirty = value !== step.text;
              return (
                <div key={step.stepId}>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Step {step.stepNumber}</p>
                  <textarea
                    value={value}
                    onChange={(e) => setDrafts((d) => ({ ...d, [step.stepId]: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                    rows={4}
                  />
                  <button
                    type="button"
                    disabled={!dirty || mutation.isPending}
                    onClick={() =>
                      mutation.mutate({ sopId: selected.sopId, stepId: step.stepId, text: value })
                    }
                    className="mt-2 rounded-md bg-sky-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
                  >
                    Save step
                  </button>
                </div>
              );
            })}
          </div>
          {mutation.error ? <p className="mt-3 text-sm text-rose-400">{(mutation.error as Error).message}</p> : null}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Library is empty until the first supervisor open seeds it.</p>
      )}
    </div>
  );
}

function CoachingView({ data }: { data: SopIntelSnapshot }) {
  if (data.coaching.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Coaching queue fills from SOP-gap pattern data. After Phase 2 reports land against a dispatcher and SOP
        step, items appear here automatically.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {data.coaching.map((item) => (
        <li key={item.coachingId} className="rounded-xl border border-slate-800 bg-[#121a26] px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="font-medium text-white">{item.dispatcherName}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                item.priority === "priority"
                  ? "bg-rose-500/15 text-rose-300"
                  : item.priority === "due"
                    ? "bg-amber-500/15 text-amber-300"
                    : "bg-slate-700 text-slate-300"
              }`}
            >
              {item.priority}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-300">
            {item.sopId} — {item.sopTitle} · {item.reportCount} report{item.reportCount === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs text-slate-500">{item.summary}</p>
          <p className="mt-2 font-mono text-xs text-sky-400">Latest call {item.latestCallId}</p>
        </li>
      ))}
    </ul>
  );
}
