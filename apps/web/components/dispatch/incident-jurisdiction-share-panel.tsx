"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSession } from "@/components/auth/session-context";
import {
  fetchIncidentShares,
  postIncidentShare,
  revokeIncidentShare,
} from "@/lib/api";

export function IncidentJurisdictionSharePanel({
  incidentId,
  ownerAgencyId,
}: {
  incidentId: string;
  ownerAgencyId: string;
}) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [recipient, setRecipient] = useState("");
  const canManage = user?.role === "supervisor" || user?.role === "agencyadmin" || user?.role === "rcsuperadmin";

  const sharesQuery = useQuery({
    queryKey: ["incident-shares", incidentId],
    queryFn: () => fetchIncidentShares(incidentId),
    enabled: Boolean(incidentId) && canManage,
  });

  const createMut = useMutation({
    mutationFn: () =>
      postIncidentShare(incidentId, {
        recipientAgencyId: recipient.trim(),
        ttlHours: 72,
      }),
    onSuccess: async () => {
      setRecipient("");
      await qc.invalidateQueries({ queryKey: ["incident-shares", incidentId] });
    },
  });

  const revokeMut = useMutation({
    mutationFn: (shareId: string) => revokeIncidentShare(incidentId, shareId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["incident-shares", incidentId] });
    },
  });

  if (!canManage) {
    return (
      <aside className="hidden w-64 shrink-0 flex-col border-l border-slate-800 bg-slate-950/40 xl:flex">
        <div className="p-2 text-[10px] text-slate-600">Agency Share is supervisor-managed.</div>
      </aside>
    );
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-slate-800 bg-slate-950/40">
      <div className="border-b border-slate-800 px-2 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Agency Share</h2>
        <p className="mt-1 text-[10px] text-slate-500">Owner agency: {ownerAgencyId}</p>
      </div>
      <div className="flex flex-col gap-2 p-2">
        <label className="text-[10px] font-medium uppercase text-slate-500">
          Recipient agency id
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
            placeholder="partner-agency-id"
          />
        </label>
        <button
          type="button"
          disabled={!recipient.trim() || createMut.isPending}
          onClick={() => createMut.mutate()}
          className="rounded bg-sky-900/50 px-2 py-1 text-xs font-medium text-sky-100 hover:bg-sky-800/60 disabled:opacity-40"
        >
          {createMut.isPending ? "Sharing…" : "Share with partner agency"}
        </button>
        {createMut.isError ? (
          <p className="text-[10px] text-rose-300">{(createMut.error as Error).message}</p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-800 p-2">
        <h3 className="text-[10px] font-semibold uppercase text-slate-500">Active / history</h3>
        <ul className="mt-1 space-y-1">
          {(sharesQuery.data ?? []).map((s) => (
            <li
              key={s.shareId}
              className="flex items-start justify-between gap-1 rounded border border-slate-800/80 bg-slate-900/30 p-1.5 text-[10px] text-slate-300"
            >
              <div>
                <div className="font-mono text-slate-400">{s.recipientAgencyId}</div>
                <div className="text-slate-500">{s.status}</div>
              </div>
              {s.status === "active" ? (
                <button
                  type="button"
                  disabled={revokeMut.isPending}
                  onClick={() => revokeMut.mutate(s.shareId)}
                  className="shrink-0 rounded bg-rose-950/60 px-1.5 py-0.5 text-[10px] text-rose-100 hover:bg-rose-900/70"
                >
                  Revoke
                </button>
              ) : null}
            </li>
          ))}
          {sharesQuery.isLoading ? <li className="text-[10px] text-slate-500">Loading…</li> : null}
          {!sharesQuery.isLoading && (sharesQuery.data?.length ?? 0) === 0 ? (
            <li className="text-[10px] text-slate-600">No share rows.</li>
          ) : null}
        </ul>
      </div>
    </aside>
  );
}
