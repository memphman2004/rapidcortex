"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { NoticeSeverity, PlatformNotice } from "rapid-cortex-shared";
import { fetchAgencies } from "@/lib/api";
import {
  cancelPlatformNotice,
  createPlatformNotice,
  fetchAdminPlatformNotices,
} from "@/lib/platform-notices-api";
import { VerticalBadge, deriveVerticalFromAgencyId, normalizeVertical, type Vertical } from "@/components/ui/VerticalBadge";
import { isVerticalEnabled } from "@/lib/features";

type NoticeTargetMode = "all" | "vertical" | "agency";

function agencyVertical(agencyId: string, vertical?: string): Vertical {
  if (vertical) return normalizeVertical(vertical);
  return deriveVerticalFromAgencyId(agencyId);
}

function noticeStatus(notice: PlatformNotice): "active" | "expired" {
  return notice.expiresAt > Math.floor(Date.now() / 1000) ? "active" : "expired";
}

export function PlatformNoticeTargetPanel() {
  const queryClient = useQueryClient();
  const agenciesQ = useQuery({ queryKey: ["agencies"], queryFn: fetchAgencies });
  const historyQ = useQuery({
    queryKey: ["platform-notices-admin"],
    queryFn: fetchAdminPlatformNotices,
    refetchInterval: 30_000,
  });

  const [mode, setMode] = useState<NoticeTargetMode>("all");
  const [vertical, setVertical] = useState<Vertical>("core");
  const [agencyId, setAgencyId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<NoticeSeverity>("info");
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabledVerticals = useMemo(
    () => (["core", "campus", "venue", "hospital"] as const).filter((v) => isVerticalEnabled(v)),
    [],
  );

  const agencies = agenciesQ.data ?? [];
  const byVertical = useMemo(() => {
    return {
      core: agencies.filter((a) => agencyVertical(a.agencyId, (a as { vertical?: string }).vertical) === "core"),
      campus: agencies.filter((a) => agencyVertical(a.agencyId, (a as { vertical?: string }).vertical) === "campus"),
      venue: agencies.filter((a) => agencyVertical(a.agencyId, (a as { vertical?: string }).vertical) === "venue"),
      hospital: agencies.filter((a) => agencyVertical(a.agencyId, (a as { vertical?: string }).vertical) === "hospital"),
    } as const;
  }, [agencies]);

  const targetSummary =
    mode === "all"
      ? `All tenants (${agencies.length})`
      : mode === "vertical"
        ? `${vertical} tenants (${byVertical[vertical].length})`
        : agencyId || "No agency selected";

  const cancelMutation = useMutation({
    mutationFn: (noticeId: string) => cancelPlatformNotice(noticeId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["platform-notices-admin"] }),
  });

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setSeverity("info");
    setExpiresInHours(24);
    setError(null);
  };

  async function handleSend() {
    if (!title.trim() || !message.trim()) {
      setError("Title and message are required.");
      return;
    }
    if (mode === "agency" && !agencyId) {
      setError("Select an agency to target.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createPlatformNotice({
        targetType: mode,
        targetVertical: mode === "vertical" ? vertical : undefined,
        targetAgencyId: mode === "agency" ? agencyId : undefined,
        severity,
        title: title.trim(),
        message: message.trim(),
        expiresInHours,
        dismissible: true,
        requiresAck: severity === "critical",
      });
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ["platform-notices-admin"] });
    } catch {
      setError("Failed to send notice. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const recentNotices = (historyQ.data ?? []).slice(0, 10);

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
      <h2 className="text-sm font-semibold text-white">Platform notice targeting</h2>
      <p className="mt-1 text-xs text-slate-400">
        Push operational notices to dispatchers and supervisors during onboarding, maintenance, or incidents.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="text-xs text-slate-400">
          Target mode
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as NoticeTargetMode)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
          >
            <option value="all">All tenants</option>
            <option value="vertical">By vertical</option>
            <option value="agency">By specific agency</option>
          </select>
        </label>
        {mode === "vertical" ? (
          <label className="text-xs text-slate-400">
            Vertical
            <select
              value={vertical}
              onChange={(e) => setVertical(e.target.value as Vertical)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            >
              {enabledVerticals.map((v) => (
                <option key={v} value={v}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {mode === "agency" ? (
          <label className="text-xs text-slate-400">
            Agency
            <select
              value={agencyId}
              onChange={(e) => setAgencyId(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            >
              <option value="">Select agency…</option>
              {agencies.map((a) => (
                <option key={a.agencyId} value={a.agencyId}>
                  {a.name} ({a.agencyId})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="text-xs text-slate-400">
          Severity
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as NoticeSeverity)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
          >
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label className="text-xs text-slate-400">
          Expires in (hours)
          <input
            type="number"
            min={1}
            max={168}
            value={expiresInHours}
            onChange={(e) => setExpiresInHours(Number(e.target.value) || 24)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
          />
        </label>
      </div>

      <label className="mt-4 block text-xs text-slate-400">
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
          placeholder="Maintenance window tonight"
        />
      </label>

      <label className="mt-4 block text-xs text-slate-400">
        Notice message
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
          placeholder="Planned maintenance notice…"
        />
      </label>

      <div className="mt-3 flex items-center gap-2 text-xs">
        {mode === "vertical" ? <VerticalBadge vertical={vertical} size="xs" /> : null}
        <span className="text-slate-400">Target: {targetSummary}</span>
      </div>

      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}

      <button
        type="button"
        disabled={submitting}
        onClick={() => void handleSend()}
        className="mt-4 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Send notice"}
      </button>

      <div className="mt-6 border-t border-slate-800 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recent notices</h3>
        {historyQ.isLoading ? (
          <p className="mt-2 text-xs text-slate-500">Loading…</p>
        ) : recentNotices.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">No notices sent yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {recentNotices.map((notice) => {
              const status = noticeStatus(notice);
              return (
                <li
                  key={notice.noticeId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-100">{notice.title}</p>
                    <p className="text-slate-400">
                      {notice.severity} · {notice.targetType}
                      {notice.targetVertical ? ` · ${notice.targetVertical}` : ""}
                      {notice.targetAgencyId ? ` · ${notice.targetAgencyId}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold uppercase ${
                        status === "active"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-slate-700 text-slate-400"
                      }`}
                    >
                      {status}
                    </span>
                    {status === "active" ? (
                      <button
                        type="button"
                        disabled={cancelMutation.isPending}
                        onClick={() => void cancelMutation.mutateAsync(notice.noticeId)}
                        className="rounded border border-slate-600 px-2 py-0.5 text-slate-300 hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
