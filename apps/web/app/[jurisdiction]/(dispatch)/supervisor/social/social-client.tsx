"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Car,
  Droplets,
  ExternalLink,
  Flame,
  HeartPulse,
  MapPin,
  Radio,
  ShieldAlert,
  Zap,
} from "lucide-react";
import type {
  SignalStatus,
  SignalUrgency,
  SocialSignal,
  SocialSignalType,
} from "rapid-cortex-shared";
import { featureSuiteFetch } from "@/lib/feature-suite-client";

const SURFACE = "bg-[#161b2e] border border-[#1e2130]";
const INPUT =
  "rounded-md border border-[#1e2130] bg-[#0f1117] px-3 py-2 text-sm text-[#e2e4ea] placeholder:text-[#6b7280] focus:outline-none focus:ring-1 focus:ring-[#378ADD]";

const URGENCY_TABS: Array<"" | SignalUrgency> = ["", "critical", "high", "medium", "low"];

const URGENCY_STYLE: Record<SignalUrgency, string> = {
  critical: "bg-[#E24B4A]/20 text-[#E24B4A] animate-pulse",
  high: "bg-[#EF9F27]/20 text-[#EF9F27]",
  medium: "bg-yellow-500/20 text-yellow-300",
  low: "bg-slate-500/20 text-slate-300",
};

const STATUS_OPTIONS: Array<"" | SignalStatus> = [
  "",
  "unreviewed",
  "reviewed",
  "corroborated",
  "dismissed",
  "linked_to_incident",
];

const DISMISS_REASONS = [
  "Unrelated to jurisdiction",
  "Already handled",
  "False information",
  "Duplicate signal",
] as const;

const SOURCE_LABEL: Record<string, string> = {
  twitter_x: "Twitter/X",
  nextdoor: "Nextdoor",
  ring_neighbors: "Ring",
  facebook: "Facebook",
  bluesky: "Bluesky",
  reddit: "Reddit",
  citizen_app: "Citizen",
};

const TYPE_ICON: Record<SocialSignalType, typeof Flame> = {
  shooting: ShieldAlert,
  fire: Flame,
  flooding: Droplets,
  accident: Car,
  fight: AlertTriangle,
  suspicious: Radio,
  utility_outage: Zap,
  medical: HeartPulse,
  other: Radio,
};

type Props = { jurisdiction: string; agencyId: string };

function relativeTime(iso: string): string {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)} minutes ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hours ago`;
  return `${Math.floor(sec / 86400)} days ago`;
}

export function SocialClient({ agencyId }: Props) {
  const qc = useQueryClient();
  const [urgency, setUrgency] = useState<"" | SignalUrgency>("");
  const [statusFilter, setStatusFilter] = useState<"" | SignalStatus>("unreviewed");
  const [selected, setSelected] = useState<SocialSignal | null>(null);
  const [showFull, setShowFull] = useState(false);
  const [linkIncidentId, setLinkIncidentId] = useState("");
  const [dismissReason, setDismissReason] = useState<string>(DISMISS_REASONS[0]);

  const query = useQuery({
    queryKey: ["feature-social", agencyId, urgency],
    queryFn: () => {
      const qs = urgency ? `?urgency=${encodeURIComponent(urgency)}` : "";
      return featureSuiteFetch<{ signals: SocialSignal[]; total: number }>(
        `social/signals${qs}`,
      );
    },
    refetchInterval: 30_000,
  });

  const signals = useMemo(() => {
    let list = [...(query.data?.signals ?? [])];
    if (statusFilter) list = list.filter((s) => s.status === statusFilter);
    const urgencyRank: Record<SignalUrgency, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    list.sort((a, b) => {
      const u = urgencyRank[a.urgency] - urgencyRank[b.urgency];
      if (u !== 0) return u;
      return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
    });
    return list;
  }, [query.data, statusFilter]);

  const reviewMut = useMutation({
    mutationFn: (payload: {
      id: string;
      status: SignalStatus;
      linkedIncidentId?: string;
      dismissalReason?: string;
    }) =>
      featureSuiteFetch(`social/signals/${payload.id}/review`, {
        method: "POST",
        body: JSON.stringify({
          status: payload.status,
          linkedIncidentId: payload.linkedIncidentId,
          dismissalReason: payload.dismissalReason,
        }),
      }),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ["feature-social", agencyId] });
      // Keep action panel open after soft "reviewed"; close on dismiss / link / corroborate.
      if (variables.status !== "reviewed") {
        setSelected(null);
        setLinkIncidentId("");
        return;
      }
      setSelected((prev) =>
        prev && prev.signalId === variables.id
          ? { ...prev, status: "reviewed" }
          : prev,
      );
    },
  });

  return (
    <div className="min-h-full bg-[#0f1117] p-4 text-[#e2e4ea] md:p-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight">Social Awareness</h1>
        <p className="mt-1 text-sm text-[#9ca3af]">
          AI-classified public signals for situational awareness — verify before acting.
        </p>
      </header>

      <div className="mb-4 rounded-md border border-[#EF9F27]/40 bg-[#EF9F27]/10 px-3 py-2 text-xs text-[#EF9F27]">
        Signals are AI-classified social media posts. Verify before acting. Not a replacement for
        911. Social signals auto-purge after 48 hours.
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {URGENCY_TABS.map((tab) => (
          <button
            key={tab || "all"}
            type="button"
            onClick={() => setUrgency(tab)}
            className={`rounded-md px-3 py-1.5 text-sm capitalize ${
              urgency === tab
                ? "bg-[#378ADD] text-white"
                : "bg-[#161b2e] text-[#9ca3af] hover:text-[#e2e4ea]"
            }`}
          >
            {tab || "All"}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <label className="text-xs text-[#9ca3af]">
          Status
          <select
            className={`${INPUT} ml-2`}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | SignalStatus)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s || "any"} value={s}>
                {s ? s.replace(/_/g, " ") : "Any"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {query.isLoading ? (
            <div className={`${SURFACE} rounded-lg p-8 text-center text-sm text-[#9ca3af]`}>
              Loading signals…
            </div>
          ) : query.isError ? (
            <div className={`${SURFACE} rounded-lg p-8 text-center text-sm text-[#E24B4A]`}>
              {(query.error as Error).message}
            </div>
          ) : signals.length === 0 ? (
            <div className={`${SURFACE} rounded-lg p-8 text-center text-sm text-[#9ca3af]`}>
              No signals match the current filters.
            </div>
          ) : (
            signals.map((signal) => {
              const Icon = TYPE_ICON[signal.signalType] ?? Radio;
              return (
                <article
                  key={signal.signalId}
                  className={`${SURFACE} rounded-lg p-4 ${
                    signal.urgency === "critical" ? "ring-1 ring-[#E24B4A]/50" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${URGENCY_STYLE[signal.urgency]}`}
                    >
                      {signal.urgency}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-[#9ca3af]">
                      <Icon className="h-3.5 w-3.5" />
                      {signal.signalType.replace(/_/g, " ")}
                    </span>
                    <span className="rounded bg-[#1a2035] px-2 py-0.5 text-[10px] text-[#6b7280]">
                      {SOURCE_LABEL[signal.source] ?? signal.source}
                    </span>
                    <span className="rounded bg-[#1a2035] px-2 py-0.5 text-[10px] capitalize text-[#6b7280]">
                      {signal.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium leading-snug">{signal.summary}</p>
                  <p className="mt-2 text-xs text-[#6b7280]">
                    {signal.location?.address
                      ? signal.location.address
                      : signal.location
                        ? `Near ${signal.location.lat.toFixed(3)}, ${signal.location.lon.toFixed(3)}`
                        : "Location unknown"}
                    {" · "}
                    AI confidence: {Math.round(signal.confidence * 100)}%
                    {" · "}
                    Detected {relativeTime(signal.detectedAt)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-md bg-[#378ADD] px-2.5 py-1.5 text-xs font-medium text-white"
                      onClick={() => {
                        setSelected(signal);
                        setShowFull(false);
                        setLinkIncidentId(signal.linkedIncidentId ?? "");
                        reviewMut.mutate({ id: signal.signalId, status: "reviewed" });
                      }}
                    >
                      Review
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-[#1a2035] px-2.5 py-1.5 text-xs"
                      onClick={() => {
                        setSelected(signal);
                        setShowFull(false);
                      }}
                    >
                      Open
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <aside className={`${SURFACE} h-fit rounded-lg p-4 lg:sticky lg:top-4`}>
          {!selected ? (
            <p className="text-sm text-[#6b7280]">
              Select a signal and click Review to open the action panel.
            </p>
          ) : (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Action panel</h2>
              <p className="text-sm">{selected.summary}</p>
              <div>
                <p className="text-xs text-[#9ca3af]">
                  {showFull
                    ? selected.rawText
                    : `${selected.rawText.slice(0, 180)}${selected.rawText.length > 180 ? "…" : ""}`}
                </p>
                {selected.rawText.length > 180 ? (
                  <button
                    type="button"
                    className="mt-1 text-xs text-[#378ADD] hover:underline"
                    onClick={() => setShowFull((v) => !v)}
                  >
                    {showFull ? "Show less" : "Show full"}
                  </button>
                ) : null}
              </div>
              {selected.sourceUrl ? (
                <a
                  href={selected.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#378ADD] hover:underline"
                >
                  Source <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
              {selected.location ? (
                <p className="inline-flex items-center gap-1 text-xs text-[#9ca3af]">
                  <MapPin className="h-3.5 w-3.5" />
                  {selected.location.address ??
                    `${selected.location.lat.toFixed(4)}, ${selected.location.lon.toFixed(4)}`}
                </p>
              ) : null}

              <label className="block text-xs text-[#9ca3af]">
                Link to incident
                <input
                  className={`${INPUT} mt-1 w-full`}
                  value={linkIncidentId}
                  onChange={(e) => setLinkIncidentId(e.target.value)}
                  placeholder="Incident ID"
                />
              </label>
              <button
                type="button"
                className="w-full rounded-md bg-[#378ADD] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                disabled={!linkIncidentId.trim() || reviewMut.isPending}
                onClick={() =>
                  reviewMut.mutate({
                    id: selected.signalId,
                    status: "linked_to_incident",
                    linkedIncidentId: linkIncidentId.trim(),
                  })
                }
              >
                Link to incident
              </button>

              <label className="block text-xs text-[#9ca3af]">
                Dismiss reason
                <select
                  className={`${INPUT} mt-1 w-full`}
                  value={dismissReason}
                  onChange={(e) => setDismissReason(e.target.value)}
                >
                  {DISMISS_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="w-full rounded-md bg-[#1a2035] px-3 py-1.5 text-xs disabled:opacity-50"
                disabled={reviewMut.isPending}
                onClick={() =>
                  reviewMut.mutate({
                    id: selected.signalId,
                    status: "dismissed",
                    dismissalReason: dismissReason,
                  })
                }
              >
                Dismiss
              </button>

              <button
                type="button"
                className="w-full rounded-md bg-[#1D9E75] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                disabled={reviewMut.isPending}
                onClick={() =>
                  reviewMut.mutate({
                    id: selected.signalId,
                    status: "corroborated",
                    linkedIncidentId: linkIncidentId.trim() || undefined,
                  })
                }
              >
                Corroborate
              </button>

              {reviewMut.isError ? (
                <p className="text-xs text-[#E24B4A]">{(reviewMut.error as Error).message}</p>
              ) : null}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
