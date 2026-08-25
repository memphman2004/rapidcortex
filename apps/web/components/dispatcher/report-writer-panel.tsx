"use client";

import { useCallback, useMemo, useState } from "react";
import type { GenerateReportRequest, IncidentReport } from "rapid-cortex-shared";
import { AuthorizationService } from "rapid-cortex-security";
import { useSession } from "@/components/auth/session-context";

type Phase = "idle" | "generating" | "reviewing" | "finalizing" | "finalized" | "pushing" | "error";

const authz = new AuthorizationService();

function NarrativeSection({
  label,
  value,
  onChange,
  rows = 6,
  locked,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  rows?: number;
  locked: boolean;
}) {
  if (!value && locked) return null;
  return (
    <div className="mb-5">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        {label}
        {!locked ? <span className="ml-2 font-normal text-slate-600">— editable</span> : null}
      </div>
      {locked ? (
        <div className="whitespace-pre-wrap rounded-md bg-slate-900/80 px-3.5 py-3 text-[13px] leading-relaxed text-slate-200">
          {value}
        </div>
      ) : (
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className="w-full resize-y rounded-md border border-slate-700 bg-slate-900/80 px-3.5 py-3 text-[13px] leading-relaxed text-slate-200 outline-none focus:border-sky-600"
        />
      )}
    </div>
  );
}

function NibrsBadge({
  report,
  onConfirm,
  onOverride,
  locked,
}: {
  report: IncidentReport;
  onConfirm: () => void;
  onOverride: (code: string, description: string) => void;
  locked: boolean;
}) {
  const n = report.nibrsClassification;
  if (!n) return null;

  const confidenceColor =
    n.confidence >= 80 ? "#10b981" : n.confidence >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div
      className={`mb-5 rounded-lg border p-3.5 ${
        report.nibrsConfirmed
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-slate-700 bg-slate-900/60"
      }`}
    >
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            NIBRS Classification {report.nibrsConfirmed ? "✓ Confirmed" : "— Review Required"}
          </div>
          <div className="text-[15px] font-bold text-slate-100">
            {n.offenseCode} — {n.offenseDescription}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Group {n.offenseGroup} · Location: {n.locationTypeCode} {n.locationTypeDescription} ·
            {n.attemptedCompleted === "C" ? " Completed" : " Attempted"}
          </div>
        </div>
        <div className="text-right text-lg font-extrabold" style={{ color: confidenceColor }}>
          {n.confidence}%
          <div className="text-[9px] font-normal text-slate-500">AI confidence</div>
        </div>
      </div>

      <div className="mb-2.5 text-[11px] leading-relaxed text-slate-500">{n.aiRationale}</div>

      {n.alternativeCodes && n.alternativeCodes.length > 0 ? (
        <div className="mb-2.5">
          <div className="mb-1 text-[10px] text-slate-500">Alternatives:</div>
          <div className="flex flex-wrap gap-1.5">
            {n.alternativeCodes.map((alt) => (
              <button
                key={alt.offenseCode}
                type="button"
                disabled={locked}
                onClick={() => onOverride(alt.offenseCode, alt.offenseDescription)}
                className="rounded border border-slate-700 bg-slate-950 px-2 py-0.5 text-[11px] text-slate-400 disabled:cursor-default"
              >
                {alt.offenseCode} — {alt.offenseDescription} ({alt.confidence}%)
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {!locked && !report.nibrsConfirmed ? (
        <label className="flex items-start gap-2 text-[12px] text-slate-300">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={false}
            onChange={() => onConfirm()}
          />
          I confirm this NIBRS offense code is correct
        </label>
      ) : null}
    </div>
  );
}

export function ReportWriterPanel({
  incidentId,
  agencyId,
  transcript,
  extractedEntities,
  callMetadata,
  agencyPreferences,
}: {
  incidentId: string;
  agencyId: string;
  transcript: string;
  extractedEntities: GenerateReportRequest["extractedEntities"];
  callMetadata?: GenerateReportRequest["callMetadata"];
  agencyPreferences?: GenerateReportRequest["agencyPreferences"];
}) {
  const { user } = useSession();
  const canFinalize = useMemo(
    () => (user ? authz.canPerform(user, "rms.finalize_report") : false),
    [user],
  );
  const canPush = useMemo(
    () => (user ? authz.canPerform(user, "rms.push_to_rms") : false),
    [user],
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [report, setReport] = useState<IncidentReport | null>(null);
  const [progressMsg, setProgressMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const locked = phase === "finalized" || report?.status === "finalized" || report?.status === "pushed_to_rms";

  async function generate() {
    setPhase("generating");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/rms/reports/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId,
          agencyId,
          transcript,
          extractedEntities,
          callMetadata,
          agencyPreferences,
        }),
      });

      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ") && currentEvent) {
            const payload = JSON.parse(line.slice(6)) as Record<string, unknown>;
            if (currentEvent === "progress") {
              setProgressMsg(String(payload.message ?? ""));
            } else if (currentEvent === "complete") {
              setReport(payload.report as IncidentReport);
              setPhase("reviewing");
            } else if (currentEvent === "error") {
              throw new Error(String(payload.message));
            }
            currentEvent = "";
          }
        }
      }
    } catch (err) {
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  const saveChanges = useCallback(
    async (updated: IncidentReport) => {
      if (!updated.reportId || locked) return;
      setSaving(true);
      try {
        await fetch(`/api/rms/reports/${updated.reportId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            narrative: updated.narrative,
            nibrsConfirmed: updated.nibrsConfirmed,
            nibrsClassification: updated.nibrsClassification,
          }),
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch {
        /* best-effort autosave */
      } finally {
        setSaving(false);
      }
    },
    [locked],
  );

  function updateNarrative(field: keyof IncidentReport["narrative"], value: string) {
    if (!report || locked) return;
    const updated = {
      ...report,
      narrative: { ...report.narrative, [field]: value },
      updatedAt: new Date().toISOString(),
    };
    setReport(updated);
    void saveChanges(updated);
  }

  async function finalize() {
    if (!report || !report.nibrsConfirmed) return;
    setPhase("finalizing");
    const res = await fetch(`/api/rms/reports/${report.reportId}/finalize`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nibrsConfirmed: true }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setPhase("error");
      setErrorMsg(err.error ?? `Finalize failed (${res.status})`);
      return;
    }
    const data = (await res.json()) as { report?: IncidentReport };
    setReport(data.report ?? { ...report, status: "finalized" });
    setPhase("finalized");
  }

  async function pushToRms() {
    if (!report) return;
    setPhase("pushing");
    const res = await fetch(`/api/rms/reports/${report.reportId}/push`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setPhase("error");
      setErrorMsg(err.error ?? `RMS push failed (${res.status})`);
      return;
    }
    const data = (await res.json()) as { report?: IncidentReport; status?: string };
    setReport(data.report ?? { ...report, rmsPushStatus: "pending_vendor" });
    setPhase("finalized");
  }

  async function exportReport() {
    if (!report) return;
    const res = await fetch(`/api/rms/reports/${report.reportId}/export`, {
      credentials: "include",
    });
    const text = await res.text();
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `incident-report-${report.incidentId}-${report.incidentDate}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-slate-200">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="m-0 text-[15px] font-bold">AI Report Writer</h3>
          <div className="mt-1 text-xs text-slate-400">
            Incident {incidentId}
            {report ? <span className="ml-2 text-slate-600">Report {report.reportId}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {saving ? <span className="text-[11px] text-slate-500">Saving…</span> : null}
          {saved ? <span className="text-[11px] text-emerald-400">✓ Saved</span> : null}
          {report && !locked ? (
            <button
              type="button"
              onClick={() => void exportReport()}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300"
            >
              Export
            </button>
          ) : null}
          {report && !locked && canFinalize && !report.nibrsConfirmed ? (
            <span className="text-[11px] text-slate-500">Confirm NIBRS to finalize</span>
          ) : null}
          {report && !locked && canFinalize && report.nibrsConfirmed ? (
            <button
              type="button"
              onClick={() => void finalize()}
              className="rounded-md bg-sky-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-sky-600"
            >
              Finalize Report
            </button>
          ) : null}
          {report && canPush && (report.status === "finalized" || report.rmsPushStatus === "pending_vendor") ? (
            <button
              type="button"
              onClick={() => void pushToRms()}
              className="rounded-md bg-amber-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-600"
            >
              {phase === "pushing" ? "Pushing…" : "Push to RMS"}
            </button>
          ) : null}
          {phase === "finalized" || report?.status === "finalized" ? (
            <span className="text-xs font-bold text-emerald-400">
              {report?.rmsPushStatus === "pending_vendor"
                ? "✓ Finalized — RMS pending vendor"
                : report?.status === "pushed_to_rms"
                  ? "✓ Pushed to RMS"
                  : "✓ Finalized"}
            </span>
          ) : null}
        </div>
      </div>

      {phase === "idle" ? (
        <button
          type="button"
          onClick={() => void generate()}
          className="w-full rounded-lg border-2 border-dashed border-slate-700 bg-slate-900/50 py-4 text-sm font-bold text-slate-400 hover:border-sky-700 hover:text-sky-300"
        >
          ✦ Generate Incident Report from Call Data
        </button>
      ) : null}

      {phase === "generating" ? (
        <div className="py-6 text-center">
          <div className="mb-2 text-sm text-slate-300">
            {progressMsg || "Generating incident report…"}
          </div>
          <div className="text-[11px] text-slate-500">
            This typically takes 20–30 seconds — please stay on this page.
          </div>
        </div>
      ) : null}

      {phase === "error" ? (
        <div className="mb-4 rounded-md border border-rose-500/30 bg-rose-500/10 p-3.5">
          <div className="text-sm text-rose-200">{errorMsg}</div>
          <button
            type="button"
            onClick={() => setPhase("idle")}
            className="mt-2 text-xs text-slate-400 underline"
          >
            Try again
          </button>
        </div>
      ) : null}

      {report && (phase === "reviewing" || phase === "finalizing" || phase === "finalized" || phase === "pushing") ? (
        <div>
          <NibrsBadge
            report={report}
            locked={!!locked}
            onConfirm={() => {
              const updated = { ...report, nibrsConfirmed: true };
              setReport(updated);
              void saveChanges(updated);
            }}
            onOverride={(code, desc) => {
              if (!report.nibrsClassification) return;
              const updated = {
                ...report,
                nibrsClassification: {
                  ...report.nibrsClassification,
                  offenseCode: code,
                  offenseDescription: desc,
                },
                nibrsConfirmed: true,
              };
              setReport(updated);
              void saveChanges(updated);
            }}
          />

          <NarrativeSection
            label="Incident Narrative"
            value={report.narrative.officerNarrative}
            onChange={(v) => updateNarrative("officerNarrative", v)}
            rows={10}
            locked={!!locked}
          />
          <NarrativeSection
            label="Suspect Description"
            value={report.narrative.suspectDescription}
            onChange={(v) => updateNarrative("suspectDescription", v)}
            rows={4}
            locked={!!locked}
          />
          <NarrativeSection
            label="Victim Information"
            value={report.narrative.victimInformation}
            onChange={(v) => updateNarrative("victimInformation", v)}
            rows={4}
            locked={!!locked}
          />
          <NarrativeSection
            label="Vehicle Information"
            value={report.narrative.vehicleInformation}
            onChange={(v) => updateNarrative("vehicleInformation", v)}
            rows={3}
            locked={!!locked}
          />
          <NarrativeSection
            label="Evidence"
            value={report.narrative.evidenceSummary}
            onChange={(v) => updateNarrative("evidenceSummary", v)}
            rows={3}
            locked={!!locked}
          />
          <NarrativeSection
            label="Officer Observations"
            value={report.narrative.officerObservations}
            onChange={(v) => updateNarrative("officerObservations", v)}
            rows={3}
            locked={!!locked}
          />
          <NarrativeSection
            label="Disposition"
            value={report.narrative.dispositionSummary}
            onChange={(v) => updateNarrative("dispositionSummary", v)}
            rows={2}
            locked={!!locked}
          />

          <div className="border-t border-slate-800 pt-3 text-[11px] text-slate-500">
            Generated from {report.transcriptWordCount.toLocaleString()} word transcript · Report
            ID: {report.reportId} · Retained 7 years per RC MSA §10.7
          </div>
        </div>
      ) : null}
    </div>
  );
}
