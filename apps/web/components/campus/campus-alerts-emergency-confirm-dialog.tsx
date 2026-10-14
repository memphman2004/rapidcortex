"use client";

import type { CampusAlertsEmergencyPreview } from "rapid-cortex-shared";

type Props = {
  open: boolean;
  preview: CampusAlertsEmergencyPreview | null;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  acknowledgment: boolean;
  onAcknowledgmentChange: (v: boolean) => void;
};

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function CampusAlertsEmergencyConfirmDialog({
  open,
  preview,
  busy,
  error,
  onCancel,
  onConfirm,
  acknowledgment,
  onAcknowledgmentChange,
}: Props) {
  if (!open || !preview) return null;

  const billingLabel =
    preview.cost.contractualBillingMode === "university_managed_provider"
      ? "Charges are billed to your university messaging provider account per your agreement."
      : "NexCort iQ records attributable usage and invoices your institution per your service agreement.";

  const canSend = acknowledgment && !busy;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="campus-alerts-emergency-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Emergency SMS Broadcast
            </p>
            <h2
              id="campus-alerts-emergency-title"
              className="mt-1 text-lg font-semibold text-slate-50"
            >
              Emergency Broadcast Confirmation
            </h2>
          </div>
          <span className="rounded-md bg-red-600/20 px-2 py-1 text-xs font-semibold text-red-300">
            Emergency Only
          </span>
        </div>

        <div className="space-y-4 px-5 py-4">
          <p className="text-base font-medium text-slate-100">Is this a true campus emergency?</p>
          <p className="text-sm leading-relaxed text-slate-300">
            Mass SMS notifications are reserved for qualifying campus emergencies.
          </p>
          <p className="text-sm leading-relaxed text-slate-300">
            Your institution will be billed for SMS usage associated with this broadcast according
            to your service agreement.
          </p>
          <p className="text-sm leading-relaxed text-slate-400">
            Please verify the emergency classification, recipient audience, message content, and
            estimated cost before proceeding.
          </p>

          <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm">
            <div>
              <dt className="text-slate-500">University</dt>
              <dd className="font-medium text-slate-100">{preview.universityName}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Authorized sender</dt>
              <dd className="font-medium text-slate-100">{preview.authorizedSender}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Classification</dt>
              <dd className="font-medium text-red-300">{preview.classification}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Affected areas</dt>
              <dd className="font-medium text-slate-100">{preview.affectedAreasLabel}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Estimated recipients</dt>
              <dd className="font-medium text-slate-100">
                {preview.cost.recipientCount.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Estimated SMS segments</dt>
              <dd className="font-medium text-slate-100">
                {preview.cost.estimatedSegments.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Illustrative rate / segment</dt>
              <dd className="font-medium text-slate-100">
                {money(preview.cost.estimatedRatePerSegmentUsd)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Estimated broadcast cost</dt>
              <dd className="text-lg font-semibold text-amber-300">
                {money(preview.cost.estimatedTotalCostUsd)}
              </dd>
            </div>
          </dl>

          <p className="text-xs text-slate-500">{preview.cost.costAssumptions}</p>
          <p className="text-xs text-slate-500">{billingLabel}</p>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Message preview</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">
              {preview.messagePreview}
            </p>
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              className="mt-1"
              checked={acknowledgment}
              onChange={(e) => onAcknowledgmentChange(e.target.checked)}
            />
            <span>
              I confirm this is an authorized emergency notification and acknowledge the applicable
              messaging charges.
            </span>
          </label>

          {error ? (
            <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex gap-3 border-t border-slate-800 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-11 flex-1 rounded-xl border border-slate-600 bg-slate-900 text-sm font-semibold text-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canSend}
            className="min-h-11 flex-1 rounded-xl bg-red-600 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Sending…" : "Confirm Emergency & Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
