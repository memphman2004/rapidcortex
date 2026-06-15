"use client";

import { useQuery } from "@tanstack/react-query";
import type { AdobeSignAgreementType, PendingProvisionStatus } from "rapid-cortex-shared";

type AgreementRow = {
  agreementId: string;
  agencyId: string;
  agreementType: AdobeSignAgreementType;
  customerEmail: string;
  customerName: string;
  contactName?: string;
  tier?: string;
  status: PendingProvisionStatus;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
};

const TEMPLATE_DOCS: { label: string; type: string; href: string }[] = [
  {
    label: "Agency pilot scope agreement (draft PDF)",
    type: "PSA",
    href: "/docs/rapidcortex-complete-manual.html",
  },
];

function agreementTypeLabel(type: AdobeSignAgreementType): string {
  if (type === "rc_lite") return "RC Lite API";
  return "Platform MSA";
}

function statusClass(status: PendingProvisionStatus): string {
  if (status === "completed") return "bg-emerald-950/60 text-emerald-300";
  if (status === "failed") return "bg-red-950/60 text-red-300";
  if (status === "processing") return "bg-sky-950/60 text-sky-300";
  return "bg-amber-950/60 text-amber-300";
}

export function RcAdminAgreementsClient() {
  const q = useQuery({
    queryKey: ["rc-admin-agreements"],
    queryFn: async () => {
      const res = await fetch("/api/rc-admin/agreements", { credentials: "include" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return (await res.json()) as { items: AgreementRow[] };
    },
    staleTime: 30_000,
  });

  const items = q.data?.items ?? [];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
        <h2 className="text-sm font-semibold text-white">Agreement templates</h2>
        <p className="mt-1 text-xs text-slate-500">
          Signed PDFs from Adobe Sign are stored in the assets bucket; this list shows webhook
          provisioning ledger entries once Adobe Sign is connected.
        </p>
        <ul className="mt-3 space-y-2">
          {TEMPLATE_DOCS.map((doc) => (
            <li key={doc.href} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-300">
                {doc.type}
              </span>
              <a href={doc.href} className="text-sky-400 hover:underline" target="_blank" rel="noreferrer">
                {doc.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-950/50">
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Signed agreements ledger</h2>
          <p className="text-xs text-slate-500">Adobe Sign webhook entries (newest first).</p>
        </div>
        {q.isLoading ? (
          <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>
        ) : q.isError ? (
          <p className="px-4 py-6 text-sm text-red-400">{(q.error as Error).message}</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No signed agreements recorded yet. Entries appear when Adobe Sign webhooks complete.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Tenant</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Contact</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.agreementId} className="border-b border-slate-900/80">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-200">{row.customerName}</div>
                      <div className="font-mono text-[11px] text-slate-500">{row.agencyId}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{agreementTypeLabel(row.agreementType)}</td>
                    <td className="px-4 py-3">
                      <div className="text-slate-300">{row.contactName ?? row.customerEmail}</div>
                      <div className="text-[11px] text-slate-500">{row.customerEmail}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass(row.status)}`}
                      >
                        {row.status}
                      </span>
                      {row.errorMessage ? (
                        <div className="mt-1 max-w-xs text-[11px] text-red-400">{row.errorMessage}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(row.updatedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
