"use client";

import type { SubmitTicketResponse } from "rapid-cortex-shared";
import { SLA_BY_SEVERITY } from "rapid-cortex-shared";

export function SupportConfirmation({
  ticket,
  agencyName,
  userName,
  onDone,
}: {
  ticket: SubmitTicketResponse;
  agencyName: string;
  userName: string;
  onDone: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.05] p-5">
        <div className="mb-1 text-sm font-bold text-emerald-400">✓ Ticket Submitted</div>
        <p className="text-xs text-emerald-300/70">
          Your support request has been received and emailed to our team.
        </p>
      </div>
      <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        <Row
          label="Ticket ID"
          value={<code className="text-[11px] text-sky-400">{ticket.ticketId}</code>}
        />
        <Row label="Severity" value={ticket.severity} />
        <Row label="Agency" value={agencyName} />
        <Row label="Submitted by" value={userName} />
      </div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        <p className="text-xs font-semibold text-slate-300">What happens next</p>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
          {SLA_BY_SEVERITY[ticket.severity]}
        </p>
        <p className="mt-2 text-[11px] text-slate-500">
          A confirmation has been sent to support@rapidcortex.us. Reference{" "}
          <span className="font-mono text-sky-500">{ticket.ticketId}</span> in any follow-ups.
        </p>
      </div>
      <button
        type="button"
        onClick={onDone}
        className="w-full rounded bg-slate-800 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
      >
        Done
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-[11px] text-slate-500">{label}</span>
      <span className="text-right text-[12px] font-medium text-slate-200">{value}</span>
    </div>
  );
}
