"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { Incident, TranscriptSegment } from "rapid-cortex-shared";
import { isApiConfigured, patchIncidentDispatch } from "@/lib/api";
import {
  callerLanguageNeedsTranslation,
  inferCallerLanguageFromSegments,
  resolveIncidentCallerLanguage,
} from "@/lib/dispatch/caller-language";
import { isCallerTranslationReplyEnabled } from "@/lib/runtime-flags";

type LanguageRow = {
  code: string;
  name: string;
  nativeName?: string;
  capabilities: { translation: boolean };
};

type LanguagesResponse = {
  ok: boolean;
  languages?: LanguageRow[];
};

function describeLanguagesFetchError(status: number, bodyText: string): string {
  try {
    const j = JSON.parse(bodyText) as { message?: string; error?: string };
    return j.message ?? j.error ?? bodyText.slice(0, 120);
  } catch {
    return bodyText.slice(0, 120) || `Request failed (${status})`;
  }
}

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

  const languagesQuery = useQuery({
    queryKey: ["call-intelligence-languages"],
    queryFn: async (): Promise<LanguagesResponse> => {
      const res = await fetch("/api/call-intelligence/languages", { credentials: "same-origin" });
      if (!res.ok) {
        const bodyText = await res.text();
        throw new Error(describeLanguagesFetchError(res.status, bodyText));
      }
      return res.json();
    },
    enabled: typeof window !== "undefined" && enabled,
    staleTime: 60_000,
  });

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

  const options = (languagesQuery.data?.languages ?? []).filter((l) => l.capabilities.translation);
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
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className="mt-1 w-full max-w-xs rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-100"
            aria-label="Caller language"
          >
            {options.length > 0 ? (
              options.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.code} — {l.name}
                  {l.nativeName ? ` (${l.nativeName})` : ""}
                </option>
              ))
            ) : (
              <>
                <option value="en">en — English</option>
                <option value="es">es — Spanish</option>
                <option value="zh">zh — Chinese</option>
                <option value="vi">vi — Vietnamese</option>
                <option value="ar">ar — Arabic</option>
              </>
            )}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {inferred ? (
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
          ) : null}
          <button
            type="button"
            disabled={saveMut.isPending || pick === resolved}
            onClick={() => saveMut.mutate(pick)}
            className="rounded bg-sky-700 px-3 py-1 text-[11px] font-medium text-white hover:bg-sky-600 disabled:opacity-40"
          >
            {saveMut.isPending ? "Saving…" : "Save language"}
          </button>
        </div>
      </div>
      {!needsTranslation ? (
        <p className="mt-2 text-[11px] text-slate-500">English callers — translation preview is optional.</p>
      ) : null}
      {saveMut.isError ? (
        <p className="mt-1 text-[11px] text-rose-400" role="alert">
          {saveMut.error instanceof Error ? saveMut.error.message : "Could not save caller language"}
        </p>
      ) : null}
      {languagesQuery.isError ? (
        <p className="mt-1 text-[11px] text-amber-300/90">
          Language directory unavailable — using built-in list.
        </p>
      ) : null}
    </div>
  );
}