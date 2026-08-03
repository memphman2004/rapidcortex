"use client";

import { useState } from "react";
import {
  ALL_STAGES,
  EMAIL_TRIGGERS,
  STATUS_CONFIG,
  type ApplicationStatus,
  type JobApplication,
} from "rapid-cortex-shared";

export { EMAIL_TRIGGERS };

const EMAIL_BADGE: Partial<
  Record<ApplicationStatus, { icon: string; label: string; color: string }>
> = {
  PHONE_SCREEN: {
    icon: "📞",
    label: "Phone screen invite will be sent",
    color: "text-orange-300 bg-orange-500/10 border-orange-500/30",
  },
  INTERVIEW: {
    icon: "🗓️",
    label: "Interview invite will be sent",
    color: "text-yellow-300 bg-yellow-500/10 border-yellow-500/30",
  },
  OFFER: {
    icon: "🎉",
    label: "Offer advance notice will be sent",
    color: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  },
  REJECTED: {
    icon: "✉️",
    label: "Rejection email will be sent",
    color: "text-slate-300 bg-slate-500/10 border-slate-500/30",
  },
};

const SCHEDULING_NEEDED = new Set<ApplicationStatus>(["PHONE_SCREEN", "INTERVIEW"]);

function displayName(a: JobApplication) {
  return `${a.firstName} ${a.lastName}`.trim() || a.email;
}

export interface StatusMoveConfirm {
  status: ApplicationStatus;
  statusNote?: string;
  schedulingLink?: string;
  customMessage?: string;
  skipEmail: boolean;
}

interface StatusMoveModalProps {
  app: JobApplication;
  onClose: () => void;
  onConfirm: (opts: StatusMoveConfirm) => void;
  busy: boolean;
  error: string | null;
}

export function StatusMoveModal({ app, onClose, onConfirm, busy, error }: StatusMoveModalProps) {
  const [status, setStatus] = useState<ApplicationStatus>(app.status);
  const [statusNote, setStatusNote] = useState("");
  const [schedulingLink, setLink] = useState("");
  const [customMessage, setCustomMsg] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  const isEmailStatus = EMAIL_TRIGGERS.has(status);
  const needsLink = SCHEDULING_NEEDED.has(status);
  const badge = EMAIL_BADGE[status];
  const changed = status !== app.status;

  function handleConfirm() {
    if (!changed) return;
    onConfirm({
      status,
      statusNote: statusNote.trim() || undefined,
      schedulingLink: needsLink && schedulingLink.trim() ? schedulingLink.trim() : undefined,
      customMessage: customMessage.trim() || undefined,
      skipEmail: !sendEmail,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-[#0e1a2e] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Move Application</h3>
            <p className="text-[11px] text-slate-500">
              {displayName(app)} · {app.email}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300">
            ✕
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`rounded px-2 py-0.5 font-bold ${STATUS_CONFIG[app.status].bgClass} ${STATUS_CONFIG[app.status].textClass}`}
            >
              {STATUS_CONFIG[app.status].label}
            </span>
            <span className="text-slate-600">→</span>
            <span
              className={`rounded px-2 py-0.5 font-bold ${STATUS_CONFIG[status].bgClass} ${STATUS_CONFIG[status].textClass}`}
            >
              {STATUS_CONFIG[status].label}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {ALL_STAGES.filter((s) => s !== "WITHDRAWN").map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={[
                  "rounded-md border px-3 py-2 text-xs font-medium transition",
                  status === s
                    ? `${STATUS_CONFIG[s].boardBorder} ${STATUS_CONFIG[s].bgClass} ${STATUS_CONFIG[s].textClass}`
                    : "border-slate-800 text-slate-500 hover:border-slate-600",
                ].join(" ")}
              >
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>

          {isEmailStatus && sendEmail && badge && (
            <div className={`rounded-md border px-3 py-2 text-xs ${badge.color}`}>
              {badge.icon} {badge.label} to <strong>{app.email}</strong>
            </div>
          )}

          {isEmailStatus && needsLink && sendEmail && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Scheduling link{" "}
                <span className="font-normal text-slate-500">(Calendly / cal.com)</span>
              </label>
              <input
                type="url"
                value={schedulingLink}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://calendly.com/…"
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500"
              />
              {!schedulingLink.trim() && (
                <p className="mt-1 text-[11px] text-amber-400/90">
                  Without a link, the email will say you will follow up to schedule.
                </p>
              )}
            </div>
          )}

          {isEmailStatus && sendEmail && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Custom message in email{" "}
                <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMsg(e.target.value)}
                rows={2}
                placeholder="Optional paragraph inserted into the applicant email…"
                className="w-full resize-none rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Internal note <span className="font-normal text-slate-500">(activity log only)</span>
            </label>
            <textarea
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              rows={2}
              placeholder="Optional note about this status change…"
              className="w-full resize-none rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500"
            />
          </div>

          {isEmailStatus && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="rounded border-slate-600"
              />
              Send automated email to applicant
            </label>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !changed}
            onClick={handleConfirm}
            className="rounded-md bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy
              ? "Moving…"
              : isEmailStatus && sendEmail
                ? "Move & Send Email"
                : "Move Application"}
          </button>
        </div>
      </div>
    </div>
  );
}
