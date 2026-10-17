"use client";

import { useCallback, useEffect, useState } from "react";
import type { PreArrivalPublicView, ResponseIQInstruction } from "rapid-cortex-shared";

function statusLabel(status: PreArrivalPublicView["status"], responder: PreArrivalPublicView["responderStatus"]): string {
  if (status === "terminated" || status === "ended") return "Session closed";
  if (responder === "arrived" || status === "active") {
    if (responder === "arrived") return "Responders on scene";
    return "Help is on the way";
  }
  if (status === "opened" || status === "sms_sent" || status === "pending_send") return "Connecting you with guidance";
  return "Help is on the way";
}

function etaCopy(minutes: number | null | undefined): string | null {
  if (minutes == null) return null;
  if (minutes <= 1) return "Responders are arriving now";
  const rounded = Math.max(1, Math.round(minutes));
  return `Estimated arrival: about ${rounded} ${rounded === 1 ? "minute" : "minutes"}`;
}

export function PreArrivalCallerClient({ token }: { token: string }) {
  const [view, setView] = useState<PreArrivalPublicView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyStep, setBusyStep] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/pre-arrival/${encodeURIComponent(token)}`);
      if (res.status === 410) {
        setError("This link has expired.");
        return;
      }
      if (!res.ok) {
        setError("Could not load guidance. Check your connection and try again.");
        return;
      }
      const data = (await res.json()) as PreArrivalPublicView;
      setView(data);
      setError(null);
    } catch {
      setError("Could not load guidance. Check your connection and try again.");
    }
  }, [token]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(id);
  }, [load]);

  const completeStep = async (step: ResponseIQInstruction) => {
    if (step.status === "COMPLETED") return;
    setBusyStep(step.stepId);
    try {
      const res = await fetch(`/api/public/pre-arrival/${encodeURIComponent(token)}/steps/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stepId: step.stepId }),
      });
      if (!res.ok) {
        setError("Could not update that step. Try again.");
        return;
      }
      const data = (await res.json()) as PreArrivalPublicView;
      setView(data);
      setError(null);
    } catch {
      setError("Could not update that step. Try again.");
    } finally {
      setBusyStep(null);
    }
  };

  if (error && !view) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0f1117] px-4 text-slate-100">
        <p className="max-w-md text-center text-sm text-slate-300">{error}</p>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0f1117] px-4 text-slate-400">
        <p className="text-sm">Loading…</p>
      </main>
    );
  }

  const closed = view.status === "ended" || view.status === "terminated";
  const eta = etaCopy(view.lastKnownEtaMinutes);
  const instructions = view.showInstructions
    ? [...view.instructions].sort((a, b) => a.order - b.order)
    : [];

  return (
    <main className="min-h-screen bg-[#0f1117] text-slate-100">
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-6">
        <header className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-400">Pre-Arrival iQ</p>
          <h1 className="text-xl font-semibold text-white">{statusLabel(view.status, view.responderStatus)}</h1>
          {eta ? <p className="text-sm text-slate-300">{eta}</p> : null}
        </header>

        {view.stayOnLine ? (
          <div
            className="rounded-md border border-amber-500/50 bg-amber-950/50 px-3 py-3 text-sm text-amber-100"
            role="status"
          >
            Your dispatcher is on the line — keep this call open.
          </div>
        ) : null}

        <section className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-3">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Status</h2>
          <p className="text-sm text-slate-200">
            {view.responderStatus === "arrived"
              ? "Responders have arrived."
              : view.responderStatus === "responding"
                ? "Responders are en route."
                : "Responders have been dispatched."}
          </p>
          {view.onSceneAt ? (
            <p className="mt-1 text-xs text-slate-500">On scene reported at {new Date(view.onSceneAt).toLocaleTimeString()}</p>
          ) : null}
        </section>

        {view.showInstructions && !closed ? (
          <section className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-3">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Guidance while you wait
            </h2>
            <ol className="space-y-3">
              {instructions.map((step) => {
                const done = step.status === "COMPLETED" || step.status === "SKIPPED";
                const suspended = step.status === "SUSPENDED";
                return (
                  <li
                    key={step.stepId}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      done
                        ? "border-emerald-900/50 bg-emerald-950/20 text-slate-400"
                        : suspended
                          ? "border-slate-800 bg-slate-900/40 text-slate-500 line-through"
                          : "border-slate-700 bg-slate-900/80 text-slate-100"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p>{step.text}</p>
                      {!done && !suspended ? (
                        <button
                          type="button"
                          disabled={busyStep === step.stepId}
                          onClick={() => void completeStep(step)}
                          className="shrink-0 rounded bg-sky-700 px-2 py-1 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-50"
                        >
                          {busyStep === step.stepId ? "…" : "Done"}
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        {!closed ? (
          <p className="text-center text-xs text-slate-500">
            If you can safely share photos, use the media link your dispatcher sends separately.
          </p>
        ) : (
          <p className="text-center text-sm text-slate-400">You can close this page.</p>
        )}

        {error ? (
          <p className="text-center text-xs text-rose-300" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
