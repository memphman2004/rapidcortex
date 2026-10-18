"use client";

import { useCallback, useEffect, useState } from "react";
import { callerGuidancePresentation, type PreArrivalPublicView, type ResponseIQInstruction } from "rapid-cortex-shared";
import { PreArrivalCallerChannel } from "@/components/pre-arrival/pre-arrival-caller-channel";

function statusLabel(
  status: PreArrivalPublicView["status"],
  responder: PreArrivalPublicView["responderStatus"],
  headline: string,
  arrived: string,
): string {
  if (status === "terminated" || status === "ended") return "You can close this page";
  if (responder === "arrived") return arrived;
  if (status === "opened" || status === "sms_sent" || status === "pending_send") return headline;
  return headline;
}

function etaCopy(view: PreArrivalPublicView): string | null {
  if (view.sessionMode !== "FULL" || view.responderStatus === "arrived") return null;
  if (view.etaRangeLow == null || view.etaRangeHigh == null) return null;
  return `Estimated arrival: ${view.etaRangeLow}–${view.etaRangeHigh} minutes`;
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
    const id = window.setInterval(() => void load(), 10_000);
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
  const eta = etaCopy(view);
  const copy =
    view.sessionMode === "STATUS_ONLY"
      ? {
          ...callerGuidancePresentation(null),
          headline: "Help has been dispatched.",
          heardLine: "Your call is in. You can stay on this page for status.",
          footer: "Stay where you are if it is safe.",
        }
      : callerGuidancePresentation(view.cadNatureCode);
  const instructions = view.showInstructions
    ? [...view.instructions].sort((a, b) => a.order - b.order)
    : [];
  const statusLine =
    view.responderStatus === "arrived"
      ? copy.arrived
      : view.responderStatus === "responding"
        ? copy.enRoute
        : copy.dispatched;

  return (
    <main className="min-h-screen bg-[#0f1117] text-slate-100">
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-6">
        <header className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-400">Pre-Arrival iQ</p>
          <h1 className="text-2xl font-semibold leading-tight text-white">
            {statusLabel(view.status, view.responderStatus, copy.headline, copy.arrived)}
          </h1>
          {!closed ? <p className="text-base leading-snug text-slate-200">{copy.heardLine}</p> : null}
          {eta ? <p className="text-sm text-slate-300">{eta}</p> : null}
          {view.sessionMode === "FULL" && typeof view.routeProgress === "number" && !closed ? (
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800" aria-hidden>
              <div
                className="h-full rounded-full bg-sky-500 transition-all duration-700"
                style={{ width: `${Math.round(view.routeProgress * 100)}%` }}
              />
            </div>
          ) : null}
        </header>

        {view.stayOnLine ? (
          <div
            className="rounded-md border border-amber-500/50 bg-amber-950/50 px-3 py-3 text-sm text-amber-100"
            role="status"
          >
            Someone is on the phone with you. Keep this call open if you can do it safely.
          </div>
        ) : null}

        <section className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-3">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Right now</h2>
          <p className="text-base text-slate-100">{statusLine}</p>
          {view.onSceneAt ? (
            <p className="mt-1 text-xs text-slate-500">On scene reported at {new Date(view.onSceneAt).toLocaleTimeString()}</p>
          ) : null}
        </section>

        {view.showInstructions && !closed ? (
          <section className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-3">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {copy.guidanceTitle}
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

        {view.channelOpen && !closed ? <PreArrivalCallerChannel token={token} /> : null}

        {!closed ? (
          <p className="text-center text-sm leading-snug text-slate-400">{copy.footer}</p>
        ) : (
          <p className="text-center text-sm text-slate-400">You can close this page. Thank you for staying with us.</p>
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
