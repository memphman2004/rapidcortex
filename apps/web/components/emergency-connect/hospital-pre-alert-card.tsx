"use client";

import { useState } from "react";
import type { HospitalPreAlert, UserRole } from "rapid-cortex-shared";
import { defaultPermissionForRole } from "rapid-cortex-security";
import { cancelHospitalPreAlert, sendHospitalPreAlert } from "@/lib/emergency-connect/api";

interface HospitalPreAlertCardProps {
  alert: HospitalPreAlert;
  userRole: UserRole;
  onRefresh: () => void;
  onEdit?: (alertId: string) => void;
}

function statusClass(status: string): string {
  switch (status) {
    case "SENT":
      return "bg-emerald-600/90 text-white";
    case "ACKNOWLEDGED":
      return "bg-sky-600/90 text-white";
    case "FAILED":
      return "bg-red-600/90 text-white";
    case "DRAFT":
      return "bg-slate-500/90 text-white";
    default:
      return "bg-amber-600/90 text-white";
  }
}

function priorityClass(priority: string): string {
  switch (priority) {
    case "CRITICAL":
      return "text-red-700 bg-red-50 border-red-200";
    case "HIGH":
      return "text-orange-700 bg-orange-50 border-orange-200";
    case "MEDIUM":
      return "text-amber-800 bg-amber-50 border-amber-200";
    default:
      return "text-sky-800 bg-sky-50 border-sky-200";
  }
}

export function HospitalPreAlertCard({
  alert,
  userRole,
  onRefresh,
  onEdit,
}: HospitalPreAlertCardProps) {
  const [isSending, setIsSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const canSend = defaultPermissionForRole(userRole, "emergency_connect.prealert_send");

  const handleSend = async () => {
    setIsSending(true);
    try {
      await sendHospitalPreAlert(alert.alertId);
      onRefresh();
    } finally {
      setIsSending(false);
      setShowConfirm(false);
    }
  };

  const handleCancel = async () => {
    await cancelHospitalPreAlert(alert.alertId);
    onRefresh();
  };

  return (
    <article className="rounded-lg border border-slate-200 border-l-4 border-l-red-600 bg-white p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Hospital Pre-Arrival Alert</h3>
          <p className="text-sm text-slate-500">Incident #{alert.incidentId.slice(-6)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass(alert.status)}`}>
            {alert.status}
          </span>
          <span
            className={`rounded border px-2 py-0.5 text-xs font-medium ${priorityClass(alert.priority)}`}
          >
            {alert.priority}
          </span>
        </div>
      </header>

      <dl className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Alert type</dt>
          <dd className="text-sm text-slate-800">{alert.alertType.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Possible condition
          </dt>
          <dd className="text-sm text-slate-800">{alert.chiefComplaint}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Hospital</dt>
          <dd className="text-sm font-semibold text-slate-900">{alert.hospitalName}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">ETA</dt>
          <dd className="text-sm text-slate-800">
            {alert.etaMinutes != null ? `${alert.etaMinutes} min` : "Not set"}
          </dd>
        </div>
        {alert.languageNeed ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Language</dt>
            <dd className="text-sm text-slate-800">{alert.languageNeed}</dd>
          </div>
        ) : null}
        {alert.emsUnitId ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">EMS unit</dt>
            <dd className="text-sm text-slate-800">{alert.emsUnitId}</dd>
          </div>
        ) : null}
      </dl>

      {alert.dispatcherSummary ? (
        <div className="mb-4 rounded-md bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-600">Dispatcher summary</p>
          <p className="mt-1 text-sm text-slate-800">{alert.dispatcherSummary}</p>
        </div>
      ) : null}

      <footer className="mb-4 space-y-1 text-xs text-slate-600">
        {alert.sentAt ? <p>Sent: {new Date(alert.sentAt).toLocaleString()}</p> : null}
        {alert.acknowledgedAt ? (
          <p className="text-emerald-700">
            Acknowledged: {new Date(alert.acknowledgedAt).toLocaleString()}
          </p>
        ) : null}
      </footer>

      <div className="flex flex-wrap gap-2">
        {alert.status === "DRAFT" && onEdit ? (
          <button
            type="button"
            onClick={() => onEdit(alert.alertId)}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Edit draft
          </button>
        ) : null}
        {alert.status === "DRAFT" && canSend ? (
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            Send to hospital
          </button>
        ) : null}
        {(alert.status === "DRAFT" || alert.status === "SENT") && canSend ? (
          <button
            type="button"
            onClick={handleCancel}
            className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
          >
            Cancel alert
          </button>
        ) : null}
      </div>

      {showConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h4 className="text-lg font-semibold text-slate-900">Confirm hospital alert</h4>
            <p className="mt-2 text-sm text-slate-700">
              Send {alert.alertType.replaceAll("_", " ")} alert to {alert.hospitalName}?
            </p>
            <p className="mt-2 text-xs text-slate-500">
              This notifies the hospital emergency department of a possible incoming patient. Use
              qualified language only (e.g. suspected, possible).
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSending}
                onClick={handleSend}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isSending ? "Sending…" : "Confirm & send"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
