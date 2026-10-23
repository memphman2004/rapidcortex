"use client";

import type { NexiqSignalRecord } from "rapid-cortex-shared";
import { formatCurrency, formatShortDate } from "@/lib/rapid-iq/scoring";
import { httpDocumentUrl, solicitationLinkLabel } from "@/lib/rapid-iq/solicitation-link";

type Props = {
  signal: NexiqSignalRecord;
  busy?: boolean;
  onClose: () => void;
  onAction: (action: "track" | "dismiss" | "push_to_crm") => void;
};

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3 border-b border-slate-800 py-2 last:border-0">
      <span className="w-28 shrink-0 text-[11px] text-slate-500">{label}</span>
      <span className="text-right text-[11px] text-slate-200">{value}</span>
    </div>
  );
}

export function CivicSignalDetail({ signal, busy = false, onClose, onAction }: Props) {
  const place = [signal.geography?.city, signal.geography?.county, signal.geography?.state]
    .filter(Boolean)
    .join(", ");
  const documentUrl = httpDocumentUrl(signal.sourceUrl);
  const linkLabel = solicitationLinkLabel(`${signal.title} ${signal.summary}`);

  return (
    <div className="flex h-full w-full max-w-xl flex-col border-l border-[rgba(255,255,255,0.06)] bg-[#0a1628] p-4 lg:max-w-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">{signal.agencyName || signal.title}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Civic IQ · {signal.confidenceTier} · {signal.confidenceScore}
            {place ? ` · ${place}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-600 hover:text-slate-400"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {signal.title && signal.title !== signal.agencyName ? (
        <h2 className="mt-4 text-sm font-medium text-slate-100">{signal.title}</h2>
      ) : null}

      <p className="mt-3 text-sm leading-relaxed text-slate-300">
        {signal.summary?.trim() || "No additional write-up was stored with this signal."}
      </p>

      <div className="mt-4">
        {documentUrl ? (
          <a
            href={documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/20"
          >
            {linkLabel} ↗
          </a>
        ) : (
          <p className="text-[11px] text-amber-200/80">No RFI or RFP link was stored with this signal.</p>
        )}
      </div>

      <div className="mt-4">
        <Row label="Agency type" value={signal.agencyType} />
        <Row label="Due" value={signal.dueDate ? formatShortDate(signal.dueDate) : null} />
        <Row
          label="Estimated value"
          value={
            signal.estimatedValue != null && signal.estimatedValue > 0
              ? formatCurrency(signal.estimatedValue)
              : null
          }
        />
        <Row label="Received" value={formatShortDate(signal.createdAt)} />
        <Row label="Keywords" value={signal.keywords.length ? signal.keywords.join(", ") : null} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="signal-pipeline-btn" disabled={busy} onClick={() => onAction("track")}>
          {busy ? "…" : "Track"}
        </button>
        <button type="button" className="btn-dismiss" disabled={busy} onClick={() => onAction("dismiss")}>
          Dismiss
        </button>
        <button
          type="button"
          className="rounded border border-violet-500/40 px-3 py-1.5 text-[11px] font-semibold text-violet-200 hover:bg-violet-500/10 disabled:opacity-50"
          disabled={busy}
          onClick={() => onAction("push_to_crm")}
        >
          Push to CRM
        </button>
      </div>
    </div>
  );
}
