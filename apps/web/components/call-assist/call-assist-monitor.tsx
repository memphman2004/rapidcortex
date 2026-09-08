"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  formatElapsedMs,
  humanizeCallAssistToken,
  mapCallAssistClassBadge,
  mapCallAssistMonitorState,
  callAssistCallerIdValue,
  callTakerConfidenceRows,
  type CallAssistUiProfile,
} from "rapid-cortex-shared";
import { useCallAssistConfig } from "@/contexts/call-assist-config-context";
import { isApiConfigured } from "@/lib/api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { getCallAssistAnalytics, getCallAssistSchedule, listCallAssistSessions } from "@/lib/call-assist/call-assist-api";
import { isCallAssistEnabled } from "@/lib/runtime-flags";
import { CallAssistChrome } from "./call-assist-chrome";
import { CallAssistCallbackQueue } from "./call-assist-callback-queue";
import { PSAPAvailabilityNotice } from "@/components/psap/psap-availability-notice";

type SessionRow = {
  sessionId: string;
  state: string;
  aniLast4?: string;
  language?: string;
  createdAt?: string;
  continueAiConversation?: boolean;
  lastConfidence?: number;
  confidenceAction?: string;
  qaLowConfidence?: boolean;
  intentConfidence?: number;
  classificationConfidence?: number;
  locationConfidence?: number;
  routingConfidence?: number;
  cadTypeLabel?: string;
  cadPriority?: number;
  intake?: { locationText?: string; incidentTypeHint?: string; addressConfidence?: number; locationSource?: string };
  triage?: { primaryClassification?: string; confidence?: number };
};

const CLASS_STYLE: Record<string, string> = {
  EMERGENCY: "bg-rose-500/15 text-rose-300",
  NON_EMERGENCY: "bg-sky-500/15 text-sky-400",
  SELF_SERVICE: "bg-slate-500/20 text-slate-400",
};

function statusMeta(state: string, profile: CallAssistUiProfile) {
  const mapped = mapCallAssistMonitorState(state);
  if (mapped === "ai_active") return { label: "AI handling", dot: "bg-sky-400 animate-pulse", color: "text-sky-400" };
  if (mapped === "transfer_911") {
    return { label: profile.escalationLabel, dot: "bg-rose-400 animate-pulse", color: "text-rose-300" };
  }
  if (mapped === "external") return { label: "Transferred", dot: "bg-amber-400", color: "text-amber-300" };
  return { label: "Completed", dot: "bg-emerald-400", color: "text-emerald-300" };
}

export function CallAssistMonitor({ canView }: { canView: boolean }) {
  const to = useJurisdictionLink();
  const { config: profile, requestAgencyId, agencyId, ready } = useCallAssistConfig();
  const enabled = Boolean(canView && isApiConfigured() && isCallAssistEnabled() && ready);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const sessionsQuery = useQuery({
    queryKey: ["call-assist-sessions", agencyId],
    queryFn: () => listCallAssistSessions("open", requestAgencyId),
    refetchInterval: 4000,
    enabled,
  });
  const analyticsQuery = useQuery({
    queryKey: ["call-assist-analytics", agencyId],
    queryFn: () => getCallAssistAnalytics(requestAgencyId),
    enabled: enabled && (profile?.capabilities.analytics ?? true),
  });
  const scheduleQuery = useQuery({
    queryKey: ["call-assist-schedule", agencyId],
    queryFn: () => getCallAssistSchedule(requestAgencyId),
    enabled,
  });
  const items = (sessionsQuery.data?.items ?? []) as SessionRow[];

  const stats = useMemo(() => {
    const ai = items.filter((s) => mapCallAssistMonitorState(s.state) === "ai_active").length;
    const transfers = analyticsQuery.data?.emergencyTransfers ?? items.filter((s) => mapCallAssistMonitorState(s.state) === "transfer_911").length;
    const survey =
      analyticsQuery.data?.surveyAverage != null ? analyticsQuery.data.surveyAverage.toFixed(1) : "—";
    return { ai, transfers, survey };
  }, [analyticsQuery.data, items]);

  if (!isCallAssistEnabled()) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-lg font-semibold text-white">Call Assist</h1>
        <p className="text-sm text-slate-400">Call Assist is not enabled for this deployment.</p>
      </div>
    );
  }

  if (!canView) {
    return <p className="p-6 text-sm text-rose-300">You do not have permission to view Call Assist.</p>;
  }

  return (
    <div className="p-4 md:p-6">
      <CallAssistChrome title="Call Assist" />
      {scheduleQuery.data?.notice ? (
        <div className="mb-3">
          <PSAPAvailabilityNotice notice={scheduleQuery.data.notice} compact />
        </div>
      ) : null}
      <p className="mb-4 max-w-2xl text-[12px] text-slate-500">
        Non-emergency AI answering and intake. Emergencies always warm-transfer — the AI never continues those
        calls. This is not a CPE or telephony replacement.
      </p>
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <Stat value={stats.ai} label="AI handling now" accent={stats.ai > 0 ? "text-sky-400" : undefined} />
        <Stat
          value={stats.transfers}
          label={profile ? `${profile.statLabel2} (open)` : "Emergency transfers (open)"}
          accent={stats.transfers > 0 ? "text-rose-400" : undefined}
        />
        <Stat value={stats.survey} label="Avg caller survey" accent="text-emerald-400" />
      </div>
      <div className="mb-3 flex flex-wrap gap-3 text-[12px]">
        {profile?.capabilities.admin ? (
          <Link className="text-sky-400 hover:underline" href={to("/call-assist/admin")}>
            Admin / routing
          </Link>
        ) : null}
        {profile?.capabilities.demo ? (
          <Link className="text-sky-400 hover:underline" href={to("/call-assist/demo")}>
            Demo runner
          </Link>
        ) : null}
        {profile?.capabilities.records ? (
          <Link className="text-sky-400 hover:underline" href={to("/call-assist/records")}>
            Records requests
          </Link>
        ) : null}
        {profile?.capabilities.analytics ? (
          <Link className="text-sky-400 hover:underline" href={to("/call-assist/analytics")}>
            Analytics
          </Link>
        ) : null}
        <Link className="text-sky-400 hover:underline" href={to("/call-assist/qa")}>
          QA
        </Link>
      </div>
      <CallAssistCallbackQueue />
      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-[11px] text-slate-500">
          <span>
            {items.length} session{items.length === 1 ? "" : "s"}
          </span>
          <span>{profile?.shortName}</span>
        </div>
        <table className="w-full text-left">
          <thead className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">{profile?.callerIdLabel ?? "Caller"}</th>
              <th className="px-3 py-2">{profile?.locationLabel ?? "Location"}</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Classification</th>
              <th className="px-3 py-2">Confidence I/C/L/R</th>
              <th className="px-3 py-2">Elapsed</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {!profile || items.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-sm text-slate-500" colSpan={8}>
                  {sessionsQuery.isLoading ? "Loading sessions…" : "No open Call Assist sessions."}
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const S = statusMeta(row.state, profile);
                const badge = mapCallAssistClassBadge(row.triage?.primaryClassification);
                const created = row.createdAt ? Date.parse(row.createdAt) : NaN;
                const elapsed = Number.isFinite(created) ? formatElapsedMs(now - created) : "—";
                const cid = callAssistCallerIdValue(profile.vertical, row);
                const loc = row.intake?.locationText?.trim() || "—";
                const type =
                  profile.classificationLabels?.[row.triage?.primaryClassification ?? ""] ||
                  row.intake?.incidentTypeHint?.trim() ||
                  humanizeCallAssistToken(row.triage?.primaryClassification);
                const scores = callTakerConfidenceRows({
                  intentScore: row.intentConfidence ?? row.lastConfidence ?? row.triage?.confidence,
                  classificationScore: row.classificationConfidence ?? row.triage?.confidence,
                  addressConfidence: row.locationConfidence ?? row.intake?.addressConfidence,
                  locationSource: row.intake?.locationSource,
                  locationText: row.intake?.locationText,
                  classification: row.triage?.primaryClassification,
                });
                const confLabel = scores.map((s) => s.score.toFixed(2)).join(" / ");
                const lang = row.language && row.language !== "en" && row.language !== "und" ? row.language : null;
                return (
                  <tr key={row.sessionId} className="cursor-pointer border-t border-slate-800 hover:bg-slate-900/60">
                    <td className="px-3 py-2.5">
                      <Link href={to(`/call-assist/sessions/${row.sessionId}`)} className="flex items-center gap-2">
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${S.dot}`} />
                        <span className={`text-[11px] ${S.color}`}>{S.label}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[12px] text-slate-100">{cid}</td>
                    <td className="px-3 py-2.5 text-[12px] text-slate-400">{loc}</td>
                    <td className="px-3 py-2.5 text-[12px] text-slate-200">{type}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${CLASS_STYLE[badge]}`}>
                        {badge === "EMERGENCY" ? "Emergency" : badge === "SELF_SERVICE" ? "Self-service" : "Non-emergency"}
                      </span>
                    </td>
                    <td className={`px-3 py-2.5 font-mono text-[10px] ${row.qaLowConfidence ? "text-amber-300" : "text-slate-400"}`}>
                      {confLabel}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-slate-400">
                      {elapsed}
                      {lang ? <span className="ml-1.5 text-[9px] text-amber-400">{lang}</span> : null}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link
                        href={to(`/call-assist/sessions/${row.sessionId}`)}
                        className="rounded border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-[10px] font-medium text-sky-400"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  accent,
}: {
  value: string | number;
  label: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3.5 py-3">
      <p className={`text-[22px] font-semibold leading-none ${accent ?? "text-slate-100"}`}>{value}</p>
      <p className="mt-1 text-[10px] text-slate-500">{label}</p>
    </div>
  );
}
