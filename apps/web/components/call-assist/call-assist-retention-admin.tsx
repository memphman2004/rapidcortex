"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CALL_ASSIST_RETENTION_DATA_TYPES, retentionDaysForType } from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import { isApiConfigured } from "@/lib/api";
import { canManageCallAssistRetention } from "@/lib/call-assist/access";
import { getCallAssistRetention, patchCallAssistRetention } from "@/lib/call-assist/call-assist-api";
import { isCallAssistEnabled } from "@/lib/runtime-flags";

const TYPE_LABEL: Record<(typeof CALL_ASSIST_RETENTION_DATA_TYPES)[number], string> = {
  audio: "Audio / recordings",
  transcript: "Transcripts",
  intake: "Intake / session records",
  analytics: "Surveys & analytics",
};

export function CallAssistRetentionAdmin() {
  const { user } = useSession();
  const allowed = canManageCallAssistRetention(user?.role);
  const enabled = Boolean(user && isApiConfigured() && isCallAssistEnabled() && allowed);
  const [msg, setMsg] = useState<string | null>(null);
  const [policyName, setPolicyName] = useState("");
  const [governingLaw, setGoverningLaw] = useState("");
  const [audio, setAudio] = useState(1095);
  const [transcript, setTranscript] = useState(1095);
  const [intake, setIntake] = useState(2555);
  const [analytics, setAnalytics] = useState(2555);

  const query = useQuery({
    queryKey: ["call-assist-retention"],
    queryFn: () => getCallAssistRetention(),
    enabled,
  });

  useEffect(() => {
    const r = query.data?.retention;
    if (!r) return;
    setPolicyName(String(r.policyName ?? r.displayName ?? ""));
    setGoverningLaw(String(r.governingLaw ?? ""));
    setAudio(Number(r.audioRetentionDays ?? 1095));
    setTranscript(Number(r.transcriptRetentionDays ?? 1095));
    setIntake(Number(r.intakeDataRetentionDays ?? 2555));
    setAnalytics(Number(r.analyticsRetentionDays ?? 2555));
  }, [query.data]);

  const save = useMutation({
    mutationFn: () =>
      patchCallAssistRetention({
        policyName,
        displayName: policyName,
        governingLaw: governingLaw || null,
        audioRetentionDays: audio,
        transcriptRetentionDays: transcript,
        intakeDataRetentionDays: intake,
        analyticsRetentionDays: analytics,
      }),
    onSuccess: () => setMsg("Retention policy saved. Daily auto-purge runs at 06:30 UTC."),
    onError: (err) => setMsg(err instanceof Error ? err.message : "Save failed"),
  });

  if (!user) return null;
  if (!allowed) {
    return <p className="p-6 text-sm text-rose-300">Retention controls are limited to agency administrators.</p>;
  }

  const lastRun = query.data?.lastRun as
    | {
        at?: string;
        sessionsDeleted?: number;
        transcriptsRedacted?: number;
        audioRedacted?: number;
        surveysDeleted?: number;
        skippedLegalHold?: number;
      }
    | null
    | undefined;
  const policy = {
    audioRetentionDays: audio,
    transcriptRetentionDays: transcript,
    intakeDataRetentionDays: intake,
    analyticsRetentionDays: analytics,
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-lg font-semibold text-white">Retention controls</h1>
      <p className="max-w-2xl text-sm text-slate-400">
        Per-data-type retention for Call Assist. Auto-purge is enforced by a scheduled job: audio and transcripts are
        redacted first; intake deletes the session; analytics deletes CSAT surveys. Legal hold on a session skips purge.
      </p>
      <label className="block text-[12px] text-slate-400">
        Policy name
        <input
          className="mt-1 w-full max-w-lg rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          value={policyName}
          onChange={(e) => setPolicyName(e.target.value)}
        />
      </label>
      <label className="block text-[12px] text-slate-400">
        Governing law
        <textarea
          className="mt-1 h-16 w-full max-w-lg rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          value={governingLaw}
          onChange={(e) => setGoverningLaw(e.target.value)}
        />
      </label>
      <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
        {CALL_ASSIST_RETENTION_DATA_TYPES.map((type) => (
          <label key={type} className="rounded-lg border border-slate-800 p-3 text-[12px] text-slate-400">
            {TYPE_LABEL[type]} (days)
            <input
              type="number"
              min={1}
              max={3650}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              value={retentionDaysForType(policy, type)}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (type === "audio") setAudio(n);
                if (type === "transcript") setTranscript(n);
                if (type === "intake") setIntake(n);
                if (type === "analytics") setAnalytics(n);
              }}
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        className="rounded bg-sky-700 px-3 py-1.5 text-[12px] text-white"
        disabled={save.isPending}
        onClick={() => save.mutate()}
      >
        Save retention
      </button>
      <section className="rounded-lg border border-slate-800 p-3 text-[12px] text-slate-400">
        <h2 className="mb-1 font-semibold text-slate-200">Last auto-purge</h2>
        {lastRun?.at ? (
          <p>
            {new Date(lastRun.at).toLocaleString()} · sessions deleted {lastRun.sessionsDeleted ?? 0} · transcripts
            redacted {lastRun.transcriptsRedacted ?? 0} · audio redacted {lastRun.audioRedacted ?? 0} · surveys deleted{" "}
            {lastRun.surveysDeleted ?? 0} · legal hold skipped {lastRun.skippedLegalHold ?? 0}
          </p>
        ) : (
          <p>No purge run recorded yet. The executor is scheduled daily.</p>
        )}
      </section>
      {msg ? <p className="text-[12px] text-amber-300">{msg}</p> : null}
    </div>
  );
}
