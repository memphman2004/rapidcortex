"use client";

import type { EscalationAuditEntry, EscalationRecord } from "rapid-cortex-shared";
import { EscalationStatusBadge } from "@/components/venue/escalation-status-badge";

export function EscalationViewerClient({
  escalation,
  audit,
  tokenExpired,
}: {
  escalation: EscalationRecord;
  audit: EscalationAuditEntry[];
  tokenExpired: boolean;
}) {
  const gps = escalation.incidentLocation.gps;
  const maps =
    gps != null
      ? `https://www.google.com/maps?q=${gps.lat},${gps.lng}`
      : null;

  function downloadJson() {
    const blob = new Blob([JSON.stringify({ escalation, audit }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${escalation.escalationId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-dvh bg-slate-950 px-4 py-8 text-slate-100 print:bg-white print:text-black">
      <div className="mx-auto max-w-3xl space-y-6">
        {tokenExpired ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-sm text-amber-200 print:border-amber-700 print:bg-amber-50 print:text-amber-900">
            Viewer token expired. This record remains available for legal review.
          </div>
        ) : null}

        <header className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-500">Rapid Cortex Escalation</p>
          <h1 className="text-2xl font-semibold">{escalation.incidentType}</h1>
          <EscalationStatusBadge status={escalation.status} />
        </header>

        <section className="rounded-xl border border-white/10 p-4 print:border-slate-300">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Critical timestamps
          </h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Created</dt>
              <dd>{escalation.escalatedAt}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Acknowledged</dt>
              <dd>{escalation.acknowledgedAt ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Retention until</dt>
              <dd>{escalation.retentionExpiresAt}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Record ID</dt>
              <dd className="font-mono text-xs">{escalation.escalationId}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-white/10 p-4 print:border-slate-300">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Incident</h2>
          <p className="text-sm">{escalation.incidentDescription}</p>
          <p className="mt-2 text-sm text-slate-400">{escalation.incidentLocation.description}</p>
          {maps ? (
            <a href={maps} className="mt-2 inline-block text-sm text-sky-400 underline" target="_blank" rel="noreferrer">
              Open GPS in Google Maps
            </a>
          ) : null}
        </section>

        <section className="rounded-xl border border-white/10 p-4 print:border-slate-300">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Chain of custody
          </h2>
          <ul className="space-y-2 text-sm">
            {audit.map((e) => (
              <li key={e.eventId} className="font-mono text-xs">
                {e.occurredAt} · {e.eventType} · {e.actor}
              </li>
            ))}
          </ul>
        </section>

        <div className="flex gap-2 print:hidden">
          <button type="button" onClick={() => window.print()} className="rounded-lg bg-white/10 px-4 py-2 text-sm">
            Print
          </button>
          <button type="button" onClick={downloadJson} className="rounded-lg bg-white/10 px-4 py-2 text-sm">
            Download JSON
          </button>
        </div>

        <footer className="text-center text-[10px] text-slate-600 print:block">
          Rapid Cortex escalation record {escalation.escalationId}
        </footer>
      </div>
    </div>
  );
}
