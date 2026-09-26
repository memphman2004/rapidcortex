"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe, Phone, Video, Languages } from "lucide-react";
import type { InterpreterRequest } from "rapid-cortex-shared";
import { featureSuiteFetch } from "@/lib/feature-suite-client";
import { isFeaturesSuiteUiEnabled } from "@/lib/runtime-flags";

const LANGS: { code: string; label: string }[] = [
  { code: "es", label: "Spanish" },
  { code: "zh", label: "Chinese" },
  { code: "vi", label: "Vietnamese" },
  { code: "ar", label: "Arabic" },
  { code: "ko", label: "Korean" },
  { code: "fr", label: "French" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "asl", label: "ASL" },
];

type Props = {
  incidentId: string;
  detectedLanguage?: string;
  detectedLabel?: string;
  aiConfidence?: number;
  className?: string;
};

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function InterpreterPanel({
  incidentId,
  detectedLanguage = "es",
  detectedLabel,
  aiConfidence,
  className,
}: Props) {
  const enabled = isFeaturesSuiteUiEnabled();
  const qc = useQueryClient();
  const [language, setLanguage] = useState(detectedLanguage);
  const [active, setActive] = useState<InterpreterRequest | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [quality, setQuality] = useState<"good" | "fair" | "poor">("good");

  useEffect(() => {
    setLanguage(detectedLanguage);
  }, [detectedLanguage]);

  useEffect(() => {
    if (!active?.connectedAt && active?.status !== "connecting" && active?.status !== "connected") {
      return;
    }
    const start = active.connectedAt
      ? new Date(active.connectedAt).getTime()
      : active.connectionStartedAt
        ? new Date(active.connectionStartedAt).getTime()
        : Date.now();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [active]);

  const requestMut = useMutation({
    mutationFn: async (opts: {
      method: "ai_translation" | "live_phone_interpreter" | "video_remote_interpreting";
      serviceProvider?: string;
      language: string;
    }) => {
      const label =
        LANGS.find((l) => l.code === opts.language)?.label ||
        detectedLabel ||
        opts.language;
      return featureSuiteFetch<{ requestId: string; status?: string }>("interpreter", {
        method: "POST",
        body: JSON.stringify({
          incidentId,
          language: opts.language === "asl" ? "en-US" : opts.language,
          languageDisplayName: opts.language === "asl" ? "ASL" : label,
          triggerReason: "dispatcher_request",
          aiConfidence,
          method: opts.method,
          serviceProvider: opts.serviceProvider,
        }),
      });
    },
    onSuccess: (res, vars) => {
      setActive({
        pk: "",
        sk: "",
        requestId: res.requestId,
        agencyId: "",
        incidentId,
        dispatcherId: "",
        language: vars.language,
        languageDisplayName:
          LANGS.find((l) => l.code === vars.language)?.label || vars.language,
        triggerReason: "dispatcher_request",
        method: vars.method,
        status: "connecting",
        serviceProvider: vars.serviceProvider,
        connectionStartedAt: new Date().toISOString(),
        connectedAt: new Date().toISOString(),
        requestedAt: new Date().toISOString(),
      });
      void qc.invalidateQueries({ queryKey: ["interpreter-list"] });
    },
  });

  const disconnectMut = useMutation({
    mutationFn: async () => {
      if (!active) return;
      return featureSuiteFetch(`interpreter/${encodeURIComponent(active.requestId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "completed",
          durationSeconds: elapsed,
          callQuality: quality,
          incidentId,
          method: active.method,
          language: active.language,
        }),
      });
    },
    onSuccess: () => {
      setActive(null);
      setElapsed(0);
      void qc.invalidateQueries({ queryKey: ["interpreter-list"] });
    },
  });

  if (!enabled) return null;

  const label =
    detectedLabel || LANGS.find((l) => l.code === language)?.label || language;
  const confPct = aiConfidence != null ? Math.round(aiConfidence * 100) : null;

  return (
    <div
      className={`rounded-md border border-slate-700/80 border-l-4 border-l-sky-400 bg-[#161b2e] text-[#e2e4ea] ${className ?? ""}`}
    >
      <div className="flex items-start gap-2 px-3 py-2">
        <Globe className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-sky-300/90">
            Language access
          </div>
          <p className="text-sm">
            Detected: {label}
            {confPct != null ? ` (AI confidence: ${confPct}%)` : ""}
          </p>
          <label className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            <Languages className="h-3.5 w-3.5" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="rounded border border-slate-600 bg-[#0f1117] px-2 py-1 text-slate-200"
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {!active && (
        <div className="flex flex-wrap gap-2 border-t border-slate-700/60 px-3 py-2">
          <button
            type="button"
            disabled={requestMut.isPending}
            onClick={() =>
              requestMut.mutate({ method: "ai_translation", language })
            }
            className="rounded border border-teal-600/60 bg-teal-950/40 px-2.5 py-1 text-xs text-teal-200 hover:bg-teal-900/40 disabled:opacity-50"
          >
            AI translation active
          </button>
          <button
            type="button"
            disabled={requestMut.isPending}
            onClick={() =>
              requestMut.mutate({
                method: "live_phone_interpreter",
                language,
                serviceProvider: "convey911",
              })
            }
            className="inline-flex items-center gap-1.5 rounded border border-sky-600/60 px-2.5 py-1 text-xs text-sky-200 hover:bg-sky-950/40 disabled:opacity-50"
          >
            <Phone className="h-3.5 w-3.5" />
            Connect human interpreter — Convey911
          </button>
          <button
            type="button"
            disabled={requestMut.isPending}
            onClick={() =>
              requestMut.mutate({
                method: "video_remote_interpreting",
                language: "asl",
              })
            }
            className="inline-flex items-center gap-1.5 rounded border border-violet-600/60 px-2.5 py-1 text-xs text-violet-200 hover:bg-violet-950/40 disabled:opacity-50"
          >
            <Video className="h-3.5 w-3.5" />
            ASL video interpreter
          </button>
        </div>
      )}

      {active && (
        <div className="space-y-2 border-t border-slate-700/60 px-3 py-2 text-xs text-slate-300">
          <p>
            Status:{" "}
            <span className="capitalize text-sky-300">
              {active.status === "connecting" ? "Connecting…" : active.status}
            </span>{" "}
            · {formatDuration(elapsed)}
          </p>
          <p>
            Interpreter: {active.interpreterName || "Pending"} ·{" "}
            {active.languageDisplayName}
          </p>
          <p>
            Session: {formatDuration(elapsed)} · Quality:{" "}
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as typeof quality)}
              className="rounded border border-slate-600 bg-[#0f1117] px-1 py-0.5"
            >
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>
          </p>
          <button
            type="button"
            disabled={disconnectMut.isPending}
            onClick={() => disconnectMut.mutate()}
            className="rounded border border-red-700/60 px-2.5 py-1 text-red-300 hover:bg-red-950/40 disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      )}

      {(requestMut.isError || disconnectMut.isError) && (
        <p className="px-3 pb-2 text-xs text-red-400">
          {((requestMut.error || disconnectMut.error) as Error).message}
        </p>
      )}
    </div>
  );
}
