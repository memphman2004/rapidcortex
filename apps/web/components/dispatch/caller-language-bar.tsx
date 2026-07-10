"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { Incident, TranscriptSegment } from "rapid-cortex-shared";
import { isApiConfigured, patchIncidentDispatch } from "@/lib/api";
import {
  callerLanguageNeedsTranslation,
  inferCallerLanguageFromSegments,
  resolveIncidentCallerLanguage,
} from "@/lib/dispatch/caller-language";
import { isCallerTranslationReplyEnabled } from "@/lib/runtime-flags";
import { LanguageSelector } from "@/components/dispatcher/LanguageSelector";

export function CallerLanguageBar({
  incidentId,
  incident,
  segments,
}: {
  incidentId: string | null;
  incident: Incident | null;
  segments: TranscriptSegment[];
}) {
  const queryClient = useQueryClient();
  const enabled = Boolean(incidentId) && isApiConfigured() && isCallerTranslationReplyEnabled();
  const inferred = useMemo(() => inferCallerLanguageFromSegments(segments), [segments]);
  const resolved = useMemo(
    () => resolveIncidentCallerLanguage(incident, segments),
    [incident, segments],
  );
  const [pick, setPick] = useState(resolved ?? "es");

  useEffect(() => {
    if (resolved) setPick(resolved);
    else if (inferred) setPick(inferred);
  }, [resolved, inferred]);

  const saveMut = useMutation({
    mutationFn: async (callerLanguage: string) => {
      if (!incidentId) throw new Error("No incident");
      return patchIncidentDispatch(incidentId, { action: "set_caller_language", callerLanguage });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["incident", incidentId] });
    },
  });

  if (!enabled || !incidentId) return null;

  const needsTranslation = callerLanguageNeedsTranslation(pick);

  return (
    <div className="shrink-0 border-b border-slate-800 bg-slate-950/70 px-4 py-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[10rem] flex-1">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Caller language</h3>
          <p className="text-[11px] text-slate-500">
            Outbound replies translate from English to this language.
            {inferred && inferred !== resolved ? (
              <span className="ml-1 text-sky-400">Detected: {inferred}</span>
            ) : null}
          </p>
          <div className="mt-1">
            <LanguageSelector
              value={pick}
              onChange={(code) => setPick(code)}
              onSave={(code) => saveMut.mutate(code)}
              saving={saveMut.isPending}
            />
          </div>
        </div>
        {inferred ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saveMut.isPending}
              onClick={() => {
                setPick(inferred);
                saveMut.mutate(inferred);
              }}
              className="rounded border border-sky-800 bg-sky-950/40 px-2 py-1 text-[11px] text-sky-200 hover:bg-sky-950/70 disabled:opacity-50"
            >
              Use detected ({inferred})
            </button>
          </div>
        ) : null}
      </div>
      {!needsTranslation ? (
        <p className="mt-2 text-[11px] text-slate-500">English callers — translation preview is optional.</p>
      ) : null}
      {saveMut.isError ? (
        <p className="mt-1 text-[11px] text-rose-400" role="alert">
          {saveMut.error instanceof Error ? saveMut.error.message : "Could not save caller language"}
        </p>
      ) : null}
    </div>
  );
}