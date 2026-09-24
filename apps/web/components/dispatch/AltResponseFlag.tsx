"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Circle, Zap } from "lucide-react";
import type { AlternativeResponseFlag } from "rapid-cortex-shared";
import { featureSuiteFetch } from "@/lib/feature-suite-client";
import { isFeaturesSuiteUiEnabled } from "@/lib/runtime-flags";

type Decision = "accept" | "reject" | "modify";

type Props = {
  flag: AlternativeResponseFlag;
  className?: string;
  onDismissed?: () => void;
};

const statusDot: Record<string, string> = {
  available: "text-emerald-400",
  busy: "text-amber-400",
  unavailable: "text-red-400",
  unknown: "text-slate-500",
};

export function AltResponseFlag({ flag, className, onDismissed }: Props) {
  const enabled = isFeaturesSuiteUiEnabled();
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState(Boolean(flag.supervisorDecision));

  const decisionMut = useMutation({
    mutationFn: async (decision: Decision) => {
      const finalDispatch =
        decision === "accept"
          ? "alt_response"
          : decision === "reject"
            ? "leo"
            : "ems";
      return featureSuiteFetch(`alt-response/${encodeURIComponent(flag.incidentId)}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision, finalDispatch }),
      });
    },
    onSuccess: () => {
      setCollapsed(true);
      void qc.invalidateQueries({ queryKey: ["alt-response", flag.incidentId] });
      onDismissed?.();
    },
  });

  if (!enabled) return null;
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className={`flex w-full items-center gap-2 rounded-md border border-amber-700/50 bg-amber-950/30 px-3 py-1.5 text-left text-xs text-amber-200 ${className ?? ""}`}
      >
        <Zap className="h-3.5 w-3.5" />
        Alt response decision logged — expand
      </button>
    );
  }

  const pct = Math.round((flag.confidence ?? 0) * 100);
  const typeLabel = flag.flagType.replace(/_/g, " ");

  return (
    <div
      className={`rounded-md border border-amber-600/50 border-l-4 border-l-amber-400 bg-amber-950/25 text-[#e2e4ea] ${className ?? ""}`}
    >
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
          <Zap className="h-3.5 w-3.5" />
          Alternative response suggested
        </div>
        <p className="mt-1 text-sm capitalize">{typeLabel} indicators detected</p>
        <p className="mt-0.5 text-xs text-slate-400">
          Confidence: {pct}%
          {flag.triggerSignals?.length
            ? ` · Signals: ${flag.triggerSignals.slice(0, 4).map((s) => `"${s}"`).join(", ")}`
            : ""}
        </p>
      </div>

      {flag.suggestedResources?.length > 0 && (
        <div className="border-t border-amber-800/40 px-3 py-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Available co-responders
          </div>
          <ul className="space-y-1 text-xs text-slate-300">
            {flag.suggestedResources.map((r) => (
              <li key={r.resourceId} className="flex items-center gap-2">
                <Circle
                  className={`h-2.5 w-2.5 fill-current ${statusDot[r.availabilityStatus] ?? statusDot.unknown}`}
                />
                <span>
                  {r.name}
                  {r.estimatedResponseMins != null
                    ? ` · Est. ${r.estimatedResponseMins} min`
                    : ""}
                  {r.availabilityStatus === "unavailable" ? " · Unavailable" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-amber-800/40 px-3 py-2">
        <button
          type="button"
          disabled={decisionMut.isPending}
          onClick={() => decisionMut.mutate("accept")}
          className="rounded bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
        >
          Dispatch alt response
        </button>
        <button
          type="button"
          disabled={decisionMut.isPending}
          onClick={() => decisionMut.mutate("reject")}
          className="rounded border border-slate-600 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          Route to LEO
        </button>
        <button
          type="button"
          disabled={decisionMut.isPending}
          onClick={() => decisionMut.mutate("modify")}
          className="rounded border border-slate-600 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          Route to EMS
        </button>
        <button
          type="button"
          disabled={decisionMut.isPending}
          onClick={() => {
            decisionMut.mutate("reject");
          }}
          className="rounded px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
      {decisionMut.isError && (
        <p className="px-3 pb-2 text-xs text-red-400">
          {(decisionMut.error as Error).message}
        </p>
      )}
    </div>
  );
}
