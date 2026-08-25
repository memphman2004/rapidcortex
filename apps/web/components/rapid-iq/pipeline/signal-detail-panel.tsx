"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type {
  RapidIqPipelineCreditToolStatus,
  RapidIqPipelineSignal,
} from "rapid-cortex-shared";
import { RAPID_IQ_PIPELINE_SOURCE_LABELS } from "rapid-cortex-shared";
import { ProcurementStageBadge } from "../procurement-stage-badge";
import {
  patchPipelineSignalStatus,
  PIPELINE_CREDITS_QUERY_KEY,
  pushPipelineSignalToCrm,
} from "@/lib/rapid-iq/pipeline-api";

type CreditsSnapshot = {
  apollo: RapidIqPipelineCreditToolStatus;
  hunter: RapidIqPipelineCreditToolStatus;
};

type Props = {
  signal: RapidIqPipelineSignal;
  credits?: CreditsSnapshot;
  /** Sit beside the clicked card instead of a full-height right rail. */
  anchored?: boolean;
  onClose: () => void;
  onSignalUpdated: (signal: RapidIqPipelineSignal) => void;
};

function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between items-start py-2 border-b border-slate-800 last:border-0">
      <span className="text-xs text-slate-500 w-32 flex-shrink-0">{label}</span>
      <span className="text-xs text-slate-300 text-right flex-1">{String(value)}</span>
    </div>
  );
}

export function SignalDetailPanel({
  signal,
  credits,
  anchored = false,
  onClose,
  onSignalUpdated,
}: Props) {
  const qc = useQueryClient();
  const [showPushForm, setShowPushForm] = useState(false);
  const [overrideAgency, setOverrideAgency] = useState(signal.agencyName ?? "");
  const [firstName, setFirstName] = useState(signal.contactHints?.[0]?.name?.split(" ")[0] ?? "");
  const [lastName, setLastName] = useState(
    signal.contactHints?.[0]?.name?.split(" ").slice(1).join(" ") ?? "",
  );
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState(signal.contactHints?.[0]?.title ?? "");
  const [pushNotes, setPushNotes] = useState("");

  const pushMutation = useMutation({
    mutationFn: () =>
      pushPipelineSignalToCrm(signal.signalId, {
        overrideAgencyName: overrideAgency.trim() || undefined,
        overrideContact:
          firstName.trim() || lastName.trim()
            ? {
                firstName: firstName.trim() || "Rapid",
                lastName: lastName.trim() || "IQ",
                email: email.trim() || undefined,
                title: title.trim() || undefined,
              }
            : undefined,
        notes: pushNotes.trim() || undefined,
      }),
    onSuccess: (result) => {
      onSignalUpdated({ ...signal, status: "pushed", crmLeadId: result.leadId });
      void qc.invalidateQueries({ queryKey: PIPELINE_CREDITS_QUERY_KEY });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: () => patchPipelineSignalStatus(signal.signalId, "dismissed"),
    onSuccess: () => onSignalUpdated({ ...signal, status: "dismissed" }),
  });

  const reviewMutation = useMutation({
    mutationFn: () => patchPipelineSignalStatus(signal.signalId, "reviewed"),
    onSuccess: () => onSignalUpdated({ ...signal, status: "reviewed" }),
  });

  const isPushed = signal.status === "pushed";
  const isDismissed = signal.status === "dismissed";
  const apolloLow = credits && credits.apollo.remaining < credits.apollo.limit * 0.2;
  const hunterLow = credits && credits.hunter.remaining < credits.hunter.limit * 0.2;

  return (
    <div
      className={
        anchored
          ? "flex max-h-[min(70vh,640px)] w-full flex-col overflow-hidden rounded-lg border border-sky-500/40 bg-slate-900 shadow-xl shadow-black/40"
          : "flex h-full w-[440px] flex-shrink-0 flex-col border-l border-slate-800 bg-slate-900"
      }
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          Signal Analysis
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-500 hover:text-white transition-colors text-lg leading-none"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-5 pb-4 border-b border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-white leading-snug">{signal.rawTitle}</h2>
              {signal.summary && (
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">{signal.summary}</p>
              )}
            </div>
            <div className="flex-shrink-0 text-right">
              <div className="text-3xl font-bold text-white">{signal.fitScore}</div>
              <div
                className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${
                  signal.fitLabel === "high"
                    ? "text-emerald-400"
                    : signal.fitLabel === "medium"
                      ? "text-amber-400"
                      : "text-slate-500"
                }`}
              >
                {signal.fitLabel} fit
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-b border-slate-800">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Signal Details
          </div>
          <DetailRow label="Source" value={RAPID_IQ_PIPELINE_SOURCE_LABELS[signal.sourceId]} />
          <div className="flex justify-between items-start py-2 border-b border-slate-800">
            <span className="text-xs text-slate-500 w-32 flex-shrink-0">Stage</span>
            <ProcurementStageBadge signal={signal} />
          </div>
          <DetailRow label="Competitor" value={signal.competitorName} />
          <DetailRow label="Product" value={signal.competitorProduct} />
          <DetailRow label="Contract end" value={signal.estimatedContractEnd} />
          <DetailRow label="Signal Date" value={signal.signalDate} />
          <DetailRow label="Agency" value={signal.agencyName} />
          <DetailRow label="Jurisdiction" value={signal.jurisdiction} />
          <DetailRow label="State" value={signal.state} />
          <DetailRow label="Agency Type" value={signal.agencyType} />
          <DetailRow label="Vendor" value={signal.vendorNamed} />
          <DetailRow label="Funding" value={signal.fundingSource} />
          <DetailRow label="Procurement" value={signal.procurementType} />
          <DetailRow
            label="Amount"
            value={
              signal.dollarAmount != null ? `$${signal.dollarAmount.toLocaleString()}` : undefined
            }
          />
        </div>

        {signal.contactHints && signal.contactHints.length > 0 && (
          <div className="px-5 py-4 border-b border-slate-800">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Mentioned Contacts
            </div>
            <div className="space-y-2">
              {signal.contactHints.map((hint, i) => (
                <div key={`${hint.name}-${i}`} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-semibold text-slate-300">
                    {hint.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs text-slate-300">{hint.name}</div>
                    {hint.title && <div className="text-[10px] text-slate-500">{hint.title}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="px-5 py-3 border-b border-slate-800">
          <a
            href={signal.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-sky-400 hover:text-sky-300 transition-colors truncate block"
          >
            View source ↗
          </a>
        </div>

        {!isPushed && !isDismissed && showPushForm && (
          <div className="px-5 py-4 border-b border-slate-800">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Push to CRM
            </div>
            {apolloLow && credits && (
              <div className="text-[11px] text-amber-400 mb-2">
                Apollo credits low — {credits.apollo.remaining} remaining this cycle
              </div>
            )}
            {hunterLow && credits && (
              <div className="text-[11px] text-amber-400 mb-2">
                Hunter credits low — {credits.hunter.remaining} remaining this cycle
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Agency Name</label>
                <input
                  value={overrideAgency}
                  onChange={(e) => setOverrideAgency(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  placeholder={signal.agencyName ?? "Agency name"}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">First Name</label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Last Name</label>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">
                  Email <span className="text-slate-600">(optional — skips enrichment when set)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Title / Role</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  placeholder="911 Director, Sheriff…"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Notes for CRM</label>
                <textarea
                  value={pushNotes}
                  onChange={(e) => setPushNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 resize-none"
                  placeholder="Outreach strategy, timing notes…"
                />
              </div>
              {pushMutation.error && (
                <div className="text-xs text-red-400">{String((pushMutation.error as Error).message)}</div>
              )}
              <button
                type="button"
                onClick={() => pushMutation.mutate()}
                disabled={pushMutation.isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold py-2 rounded-md transition-colors"
              >
                {pushMutation.isPending ? "Creating lead…" : "Create CRM Lead"}
              </button>
            </div>
          </div>
        )}

        {isPushed && (
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <span className="text-base">✓</span>
              <div>
                <div className="text-xs font-semibold">In CRM Pipeline</div>
                {signal.crmLeadId && (
                  <div className="text-[10px] text-slate-500">Lead ID: {signal.crmLeadId}</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {!isPushed && !isDismissed && (
        <div className="px-5 py-4 border-t border-slate-800 flex flex-col gap-2">
          {!showPushForm ? (
            <>
              {apolloLow && credits && (
                <div className="text-[11px] text-amber-400 mb-1">
                  Apollo credits low — {credits.apollo.remaining} remaining this cycle
                </div>
              )}
              {hunterLow && credits && (
                <div className="text-[11px] text-amber-400 mb-1">
                  Hunter credits low — {credits.hunter.remaining} remaining this cycle
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowPushForm(true)}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold py-2.5 rounded-md transition-colors"
              >
                Push to CRM Pipeline
                {credits && (
                  <span className="ml-2 text-[10px] opacity-70 font-normal">
                    {credits.apollo.remaining} Apollo · {credits.hunter.remaining} Hunter
                  </span>
                )}
              </button>
              {signal.status === "new" && (
                <button
                  type="button"
                  onClick={() => reviewMutation.mutate()}
                  disabled={reviewMutation.isPending}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium py-2 rounded-md transition-colors"
                >
                  Mark Reviewed
                </button>
              )}
              <button
                type="button"
                onClick={() => dismissMutation.mutate()}
                disabled={dismissMutation.isPending}
                className="w-full text-slate-500 hover:text-slate-400 text-xs py-1.5 transition-colors"
              >
                Dismiss Signal
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowPushForm(false)}
              className="w-full text-slate-500 hover:text-slate-400 text-xs py-1.5 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
