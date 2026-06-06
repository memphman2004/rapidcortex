"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { PlatformOnboardingStepId, PlatformOnboardingStepStatus } from "rapid-cortex-shared";
import { patchAgency } from "@/lib/api";

const STEP_LABELS: Record<PlatformOnboardingStepId, string> = {
  tenant_created: "Tenant created",
  first_admin: "First admin provisioned",
  cognito_ready: "Cognito / auth ready",
  dns_web: "DNS & web / TLS",
  ses: "SES / email",
  sms: "SMS (Twilio / AWS)",
  live_video: "Live video (KVS / WebRTC)",
  cad: "CAD integration",
  training: "Training complete",
  go_live: "Go-live approved",
};

const statusBadge: Record<PlatformOnboardingStepStatus, string> = {
  pending: "bg-slate-800 text-slate-300 ring-slate-600",
  in_progress: "bg-blue-950/50 text-sky-200 ring-blue-500/30",
  complete: "bg-emerald-950/50 text-emerald-200 ring-emerald-500/30",
  blocked: "bg-rose-950/50 text-rose-200 ring-rose-500/35",
};

type Props = {
  agencyId: string;
  steps: Partial<Record<PlatformOnboardingStepId, PlatformOnboardingStepStatus>>;
  notesByStep?: Partial<Record<PlatformOnboardingStepId, string>>;
  agencyNote?: string;
};

export function OnboardingChecklistCard({ agencyId, steps, notesByStep, agencyNote: initialAgencyNote }: Props) {
  const qc = useQueryClient();
  const [agencyNote, setAgencyNote] = useState(initialAgencyNote ?? "");

  const updateMut = useMutation({
    mutationFn: (payload: {
      step: PlatformOnboardingStepId;
      status: PlatformOnboardingStepStatus;
    }) =>
      patchAgency(agencyId, {
        platformOnboarding: {
          steps: { [payload.step]: payload.status },
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["agency", agencyId] });
    },
  });

  const saveNoteMut = useMutation({
    mutationFn: () =>
      patchAgency(agencyId, {
        platformOnboarding: { agencyNote: agencyNote.trim() || undefined },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["agency", agencyId] });
    },
  });

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Onboarding checklist
      </h2>
      <p className="mt-1 text-xs text-slate-500">Internal Rapid Cortex — tracked in agency config</p>
      <ul className="mt-4 space-y-2">
        {(Object.keys(STEP_LABELS) as PlatformOnboardingStepId[]).map((step) => {
          const status: PlatformOnboardingStepStatus = steps[step] ?? "pending";
          return (
            <li
              key={step}
              className="flex flex-col gap-1 rounded-md border border-slate-800/60 bg-slate-950/40 p-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-1 items-center gap-2">
                <span
                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ${statusBadge[status]}`}
                >
                  {status.replace("_", " ")}
                </span>
                <span className="text-sm text-slate-200">{STEP_LABELS[step]}</span>
              </div>
              <div className="flex flex-wrap gap-1 sm:shrink-0">
                {(["pending", "in_progress", "complete", "blocked"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={updateMut.isPending}
                    onClick={() => updateMut.mutate({ step, status: s })}
                    className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                      status === s
                        ? "bg-slate-800 text-white ring-1 ring-slate-600"
                        : "bg-slate-900/80 text-slate-400 hover:text-white"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {notesByStep?.[step] ? (
                <p className="w-full pl-0 text-[11px] text-slate-500 sm:pl-0">{notesByStep[step]}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 border-t border-slate-800/80 pt-3">
        <label className="text-xs text-slate-500">Agency note (internal)</label>
        <textarea
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
          rows={3}
          value={agencyNote}
          onChange={(e) => setAgencyNote(e.target.value)}
        />
        <button
          type="button"
          onClick={() => saveNoteMut.mutate()}
          disabled={saveNoteMut.isPending}
          className="mt-1 rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 ring-1 ring-slate-600 hover:bg-slate-700"
        >
          Save note
        </button>
      </div>
    </section>
  );
}
