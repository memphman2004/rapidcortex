"use client";

import { useState } from "react";
import type { TriageResult } from "rapid-cortex-shared/triage/triage";
import { TriageOverrideModal } from "./triage-override-modal";

type BadgeState =
  | "idle"
  | "analyzing"
  | "emergency"
  | "non_emergency"
  | "uncertain"
  | "overridden";

function resolveState(result: TriageResult | null, isAnalyzing: boolean): BadgeState {
  if (isAnalyzing && !result) return "analyzing";
  if (!result?.classification) return "idle";
  if (result.classification === "EMERGENCY") return "emergency";
  if (result.classification === "NON_EMERGENCY") return "non_emergency";
  if (result.classification === "UNCERTAIN") return "uncertain";
  return "idle";
}

const BADGE_CLASS: Record<Exclude<BadgeState, "idle">, string> = {
  analyzing: "border-sky-500/50 bg-sky-950/40 text-sky-300",
  emergency: "border-emerald-500/50 bg-emerald-950/30 text-emerald-300",
  non_emergency: "border-amber-500/50 bg-amber-950/30 text-amber-300",
  uncertain: "border-orange-500/50 bg-orange-950/30 text-orange-300",
  overridden: "border-emerald-500/50 bg-emerald-950/30 text-emerald-300",
};

const BADGE_LABEL: Record<Exclude<BadgeState, "idle">, string> = {
  analyzing: "Analyzing…",
  emergency: "EMERGENCY",
  non_emergency: "NON-EMERGENCY",
  uncertain: "UNCERTAIN — Treating as Emergency",
  overridden: "ESCALATED BY DISPATCHER",
};

export function TriageBadge({
  incidentId,
  result,
  isAnalyzing = false,
  onOverrideSuccess,
}: {
  incidentId: string;
  result: TriageResult | null;
  isAnalyzing?: boolean;
  onOverrideSuccess?: () => void;
}) {
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overridden, setOverridden] = useState(false);

  const state: BadgeState = overridden ? "overridden" : resolveState(result, isAnalyzing);
  if (state === "idle") return null;

  const cls = BADGE_CLASS[state];
  const label = BADGE_LABEL[state];
  const confidencePct = result
    ? result.classification
      ? Math.round(result.confidence * (result.confidence <= 1 ? 100 : 1))
      : Math.round(result.confidence * 100)
    : null;

  return (
    <>
      <div
        className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 ${cls}`}
        role="status"
        aria-live="polite"
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full bg-current ${
            state === "analyzing" || state === "non_emergency" ? "animate-pulse" : ""
          }`}
        />
        <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
        {confidencePct != null && state !== "overridden" ? (
          <span className="text-[9px] tabular-nums opacity-75">{confidencePct}%</span>
        ) : null}
        {state === "non_emergency" ? (
          <button
            type="button"
            onClick={() => setOverrideOpen(true)}
            className="ml-1 rounded border border-current/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide hover:bg-white/5"
          >
            Override →
          </button>
        ) : null}
      </div>

      {overrideOpen ? (
        <TriageOverrideModal
          incidentId={incidentId}
          currentClassification={result?.classification ?? "NON_EMERGENCY"}
          confidence={confidencePct ?? 0}
          reasoning={result?.reasoning ?? ""}
          onSuccess={() => {
            setOverridden(true);
            setOverrideOpen(false);
            onOverrideSuccess?.();
          }}
          onClose={() => setOverrideOpen(false)}
        />
      ) : null}
    </>
  );
}
