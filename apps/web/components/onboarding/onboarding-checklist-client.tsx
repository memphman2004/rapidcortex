"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  checklistStepsForVertical,
  countChecklistCompletion,
  type OnboardingChecklistStepId,
  type OnboardingChecklistStepStatus,
  type OnboardingVertical,
} from "rapid-cortex-shared";
import { Loader2 } from "lucide-react";
import { ONBOARDING_CHECKLIST_STEP_LABELS } from "@/lib/onboarding/checklist-labels";
import {
  fetchCampusChecklist,
  fetchVenueChecklist,
  patchCampusChecklist,
  patchVenueChecklist,
} from "@/lib/onboarding/onboarding-api";

type Props = {
  vertical: OnboardingVertical;
  orgCode: string;
  agencyId?: string;
};

export function OnboardingChecklistClient({ vertical, orgCode, agencyId }: Props) {
  const qc = useQueryClient();
  const stepIds = checklistStepsForVertical(vertical);
  const queryKey = ["onboarding-checklist", vertical, orgCode, agencyId ?? ""];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (vertical === "campus") {
        return fetchCampusChecklist({ orgCode, agencyId });
      }
      return fetchVenueChecklist({ orgCode, agencyId });
    },
  });

  const updateMut = useMutation({
    mutationFn: (payload: {
      step: OnboardingChecklistStepId;
      status: OnboardingChecklistStepStatus;
    }) => {
      const patch = { steps: { [payload.step]: payload.status } };
      return vertical === "campus"
        ? patchCampusChecklist({ orgCode, agencyId }, patch)
        : patchVenueChecklist({ orgCode, agencyId }, patch);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey });
    },
  });

  const steps = data?.steps ?? {};
  const progress = countChecklistCompletion(vertical, steps);
  const [notes, setNotes] = useState<Partial<Record<OnboardingChecklistStepId, string>>>(
    data?.notesByStep ?? {},
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading checklist…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {vertical === "campus" ? "Campus" : "Venue"} onboarding
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Onboarding checklist</h1>
        <p className="mt-1 text-sm text-slate-400">
          Org code <span className="font-mono text-slate-200">{orgCode}</span>
        </p>
        <div className="mt-4">
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-white">{progress.percent}%</span>
            <span className="text-sm text-slate-400">
              {progress.completed} of {progress.total} complete
            </span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      </div>

      <ul className="space-y-2">
        {stepIds.map((stepId) => {
          const status: OnboardingChecklistStepStatus = steps[stepId] ?? "pending";
          const complete = status === "complete";
          return (
            <li
              key={stepId}
              className="rounded-lg border border-slate-800 bg-slate-900/40 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <p className={`text-sm ${complete ? "text-emerald-200" : "text-slate-200"}`}>
                    {ONBOARDING_CHECKLIST_STEP_LABELS[stepId] ?? stepId}
                  </p>
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={complete}
                    disabled={updateMut.isPending}
                    onChange={(e) =>
                      updateMut.mutate({
                        step: stepId,
                        status: e.target.checked ? "complete" : "pending",
                      })
                    }
                    className="h-4 w-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500"
                  />
                  Complete
                </label>
              </div>
              <textarea
                className="mt-3 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-300"
                rows={2}
                placeholder="Optional note"
                value={notes[stepId] ?? ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [stepId]: e.target.value }))}
                onBlur={() => {
                  const note = notes[stepId]?.trim();
                  if (note === (data?.notesByStep?.[stepId] ?? "")) return;
                  const patch = { notesByStep: { [stepId]: note ?? "" } };
                  void (vertical === "campus"
                    ? patchCampusChecklist({ orgCode, agencyId }, patch)
                    : patchVenueChecklist({ orgCode, agencyId }, patch)
                  ).then(() => qc.invalidateQueries({ queryKey }));
                }}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
