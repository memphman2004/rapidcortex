"use client";

import { useCallback, useState } from "react";
import type { AIGateConfig, AIGateFeatureKey, AIGateFeatureMap } from "rapid-cortex-shared";
import { AI_GATE_FEATURES } from "rapid-cortex-shared";
import { useAIGate } from "@/lib/ai-gate";
import { isAiFeatureGateEnabled } from "@/lib/runtime-flags";

const FEATURE_LABELS: Record<AIGateFeatureKey, string> = {
  callHandling: "Call Assist (Connect / Lex / Bedrock)",
  incidentSuggestions: "Incident type / priority suggestions",
  priorityScoring: "Priority scoring",
  transcription: "Live transcription",
  summaries: "Post-incident summaries",
  cameraAnalysis: "Camera / Vision AI analysis",
  translation: "RC Translate",
  patternDetection: "Pattern / anomaly detection",
};

type Props = {
  agencyId: string;
  canToggle: boolean;
  activeIncidentCount?: number;
};

export function AIFeatureGateControl({ agencyId, canToggle, activeIncidentCount }: Props) {
  const gate = useAIGate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingEnabled, setPendingEnabled] = useState<boolean | null>(null);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [draftFeatures, setDraftFeatures] = useState<AIGateFeatureMap | null>(null);

  const submit = useCallback(
    async (enabled: boolean, features?: Partial<AIGateFeatureMap>) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/agency/${encodeURIComponent(agencyId)}/config/ai-mode`, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled,
            reason: reason.trim() || undefined,
            features,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        setConfirmOpen(false);
        setPendingEnabled(null);
        setReason("");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [agencyId, reason],
  );

  if (!isAiFeatureGateEnabled()) return null;

  const features = draftFeatures ?? gate.features;

  return (
    <div className="space-y-4 rounded-lg border border-slate-700/80 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">AI Feature Gate</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            Master switch for agency AI surfaces. 911 transfer and RCS safety paths are never gated.
          </p>
        </div>
        <div
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            gate.aiEnabled
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-amber-500/15 text-amber-200"
          }`}
        >
          {gate.aiEnabled ? "AI Active" : "Manual Mode"}
        </div>
      </div>

      {gate.toggledBy !== "system" && (
        <p className="text-xs text-slate-500">
          Last changed {gate.toggledAt ? new Date(gate.toggledAt).toLocaleString() : "—"} by{" "}
          {gate.toggledBy}
          {gate.toggleReason ? ` — ${gate.toggleReason}` : ""}
        </p>
      )}

      {canToggle ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !gate.aiEnabled}
            onClick={() => {
              setPendingEnabled(false);
              setConfirmOpen(true);
            }}
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-100 hover:bg-amber-500/20 disabled:opacity-40"
          >
            Disable all AI
          </button>
          <button
            type="button"
            disabled={busy || gate.aiEnabled}
            onClick={() => {
              setPendingEnabled(true);
              setConfirmOpen(true);
            }}
            className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-40"
          >
            Enable AI
          </button>
          <button
            type="button"
            disabled={busy || !gate.aiEnabled}
            onClick={() => {
              setDraftFeatures({ ...gate.features });
              setFeaturesOpen((v) => !v);
            }}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
          >
            {featuresOpen ? "Hide features" : "Per-feature toggles"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-500">View only — supervisor or agency admin required to change.</p>
      )}

      {featuresOpen && canToggle && (
        <div className="space-y-2 rounded-md border border-slate-700 bg-slate-950/50 p-3">
          {AI_GATE_FEATURES.map((key) => (
            <label key={key} className="flex items-center justify-between gap-3 text-sm text-slate-300">
              <span>{FEATURE_LABELS[key]}</span>
              <input
                type="checkbox"
                checked={Boolean(features[key])}
                disabled={busy || !gate.aiEnabled}
                onChange={(e) =>
                  setDraftFeatures((prev) => ({
                    ...(prev ?? gate.features),
                    [key]: e.target.checked,
                  }))
                }
              />
            </label>
          ))}
          <button
            type="button"
            disabled={busy || !draftFeatures}
            onClick={() => void submit(true, draftFeatures ?? undefined)}
            className="mt-2 rounded-md bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-500 disabled:opacity-40"
          >
            Save feature overrides
          </button>
        </div>
      )}

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {confirmOpen && pendingEnabled !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-xl">
            <h3 className="text-base font-semibold text-white">
              {pendingEnabled ? "Enable AI features?" : "Disable all AI features?"}
            </h3>
            <p className="text-sm text-slate-400">
              {pendingEnabled
                ? "Restores the master AI switch. Individual features can still be off."
                : "Forces every gated AI feature off for this agency until re-enabled."}
            </p>
            {typeof activeIncidentCount === "number" && activeIncidentCount > 0 && (
              <p className="text-sm text-amber-200">
                {activeIncidentCount} active incident{activeIncidentCount === 1 ? "" : "s"} — operators may
                be mid-call.
              </p>
            )}
            <label className="block text-xs text-slate-400">
              Reason (optional, max 500)
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 500))}
                rows={3}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setConfirmOpen(false);
                  setPendingEnabled(null);
                }}
                className="rounded-md px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit(pendingEnabled)}
                className="rounded-md bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-500 disabled:opacity-40"
              >
                {busy ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keep config shape referenced for TypeScript consumers */}
      <span className="hidden" aria-hidden>
        {(gate as AIGateConfig).agencyId}
      </span>
    </div>
  );
}
