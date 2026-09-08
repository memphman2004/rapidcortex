"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ALERT_INITIATED_COPY,
  ALERT_SMS_CARRIER_CAVEAT,
  interpolateAlertTemplate,
  type AlertChannel,
  type AlertDispatchJob,
  type AlertRecipientGroup,
  type AlertTemplate,
  type AlertVertical,
} from "rapid-cortex-shared";

type Props = {
  vertical: AlertVertical;
  basePath: string;
  displayName: string;
  canDispatch: boolean;
  canDispatchCritical: boolean;
  canManageRecipients: boolean;
  canManageTemplates: boolean;
};

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function VerticalAlertsDispatchClient({
  vertical,
  basePath,
  displayName,
  canDispatch,
  canDispatchCritical,
  canManageRecipients,
  canManageTemplates,
}: Props) {
  const [templates, setTemplates] = useState<AlertTemplate[]>([]);
  const [groups, setGroups] = useState<AlertRecipientGroup[]>([]);
  const [jobs, setJobs] = useState<AlertDispatchJob[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [channels, setChannels] = useState<AlertChannel[]>(["WEB_DASHBOARD"]);
  const [bodyOverride, setBodyOverride] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const q = `vertical=${encodeURIComponent(vertical)}`;
    const [t, g, j] = await Promise.all([
      readJson<{ templates: AlertTemplate[] }>(await fetch(`/api/alerts/templates?${q}`, { cache: "no-store" })),
      readJson<{ groups: AlertRecipientGroup[] }>(await fetch(`/api/alerts/groups?${q}`, { cache: "no-store" })),
      readJson<{ jobs: AlertDispatchJob[] }>(await fetch("/api/alerts/dispatch", { cache: "no-store" })),
    ]);
    setTemplates(t.templates);
    setGroups(g.groups);
    setJobs(j.jobs);
    setTemplateId((prev) => prev || t.templates[0]?.templateId || "");
    setGroupIds((prev) => (prev.length ? prev : g.groups.slice(0, 1).map((x) => x.groupId)));
  }, [vertical]);

  useEffect(() => {
    void load().catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [load]);

  const selected = templates.find((t) => t.templateId === templateId);
  const preview = useMemo(() => {
    const raw = bodyOverride || selected?.body || "";
    return interpolateAlertTemplate(raw, {
      campusName: displayName,
      venueName: displayName,
      agencyName: displayName,
    });
  }, [bodyOverride, selected, displayName]);

  const criticalBlocked = selected?.severity === "CRITICAL" && !canDispatchCritical;
  const confirmReady = confirmText.trim().toUpperCase() === "CONFIRM";

  const toggleChannel = (ch: AlertChannel) => {
    setChannels((cur) => (cur.includes(ch) ? cur.filter((c) => c !== ch) : [...cur, ch]));
  };

  const send = async () => {
    if (!selected || !confirmReady || channels.length === 0) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/alerts/dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vertical,
          templateId: selected.templateId,
          bodyOverride: bodyOverride.trim() || undefined,
          groupIds,
          channels,
          confirmation: confirmText,
          confirmationToken: confirmText,
        }),
      });
      const data = await readJson<{ jobId: string }>(res);
      setConfirmOpen(false);
      setConfirmText("");
      window.location.href = `${basePath}/${data.jobId}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dispatch failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Emergency occupant alert</h2>
        <p className="mt-1 text-sm text-slate-400">{ALERT_INITIATED_COPY}</p>
        <p className="mt-1 text-xs text-amber-200/90">{ALERT_SMS_CARRIER_CAVEAT}</p>
        <p className="mt-2 text-xs text-slate-500">
          Staff-only notify remains on the existing campus/venue/transit tools. This console reaches
          registered occupants (and open console sessions on the web dashboard channel).
        </p>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        {canManageRecipients ? (
          <Link className="text-sky-400 hover:underline" href={`${basePath}/recipients`}>
            Recipients
          </Link>
        ) : null}
        {canManageTemplates ? (
          <Link className="text-sky-400 hover:underline" href={`${basePath}/templates`}>
            Templates
          </Link>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {!canDispatch ? (
        <p className="text-sm text-slate-400">Your role can view alert history but cannot dispatch occupant alerts.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block text-sm text-slate-300">
            Template
            <select
              className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-2"
              value={templateId}
              onChange={(e) => {
                setTemplateId(e.target.value);
                setBodyOverride("");
              }}
            >
              {templates.map((t) => (
                <option key={t.templateId} value={t.templateId}>
                  {t.title} ({t.severity})
                </option>
              ))}
            </select>
          </label>
          <fieldset className="text-sm text-slate-300">
            <legend>Groups</legend>
            <div className="mt-1 max-h-36 space-y-1 overflow-auto rounded border border-slate-700 p-2">
              {groups.map((g) => (
                <label key={g.groupId} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={groupIds.includes(g.groupId)}
                    onChange={() =>
                      setGroupIds((cur) =>
                        cur.includes(g.groupId) ? cur.filter((id) => id !== g.groupId) : [...cur, g.groupId],
                      )
                    }
                  />
                  {g.name}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="text-sm text-slate-300">
            <legend>Channels</legend>
            <div className="mt-1 space-y-1">
              {(["WEB_DASHBOARD", "SMS", "EMAIL", "WEB_PUSH"] as AlertChannel[]).map((ch) => (
                <label key={ch} className="flex items-center gap-2">
                  <input type="checkbox" checked={channels.includes(ch)} onChange={() => toggleChannel(ch)} />
                  {ch.replaceAll("_", " ")}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm text-slate-300 lg:col-span-2">
            Message (operators may edit body; system type/severity cannot change)
            <textarea
              className="mt-1 min-h-[120px] w-full rounded border border-slate-600 bg-slate-900 px-2 py-2"
              value={bodyOverride || selected?.body || ""}
              onChange={(e) => setBodyOverride(e.target.value)}
              maxLength={2000}
            />
            <span className="text-xs text-slate-500">{preview.length} characters · preview uses {displayName}</span>
          </label>
        </div>
      )}

      {canDispatch ? (
        <button
          type="button"
          disabled={!selected || groupIds.length === 0 || channels.length === 0 || criticalBlocked}
          onClick={() => setConfirmOpen(true)}
          className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {criticalBlocked ? "CRITICAL requires campus/venue/transit admin" : "Send occupant alert…"}
        </button>
      ) : null}

      <div>
        <h3 className="text-sm font-semibold text-slate-200">Recent alerts</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {jobs.slice(0, 12).map((job) => (
            <li key={job.jobId}>
              <Link className="text-sky-400 hover:underline" href={`${basePath}/${job.jobId}`}>
                {job.title}
              </Link>
              <span className="ml-2 text-slate-500">
                {job.status} · {new Date(job.initiatedAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-600 bg-slate-900 p-5">
            <h3 className="text-lg font-semibold text-white">Confirm occupant alert</h3>
            <p className="mt-2 text-sm text-slate-300">{preview}</p>
            <p className="mt-3 text-xs text-amber-200">{ALERT_SMS_CARRIER_CAVEAT}</p>
            <label className="mt-4 block text-sm text-slate-300">
              Type CONFIRM
              <input
                className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-2 uppercase"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded px-3 py-2 text-sm text-slate-300" onClick={() => setConfirmOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={!confirmReady || sending}
                onClick={() => void send()}
                className="rounded bg-red-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
