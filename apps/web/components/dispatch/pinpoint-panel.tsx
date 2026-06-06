"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  fetchPinpointLinkDetail,
  fetchPinpointLinks,
  isApiConfigured,
  postPinpointLink,
  postPinpointLinkRevoke,
} from "@/lib/api";
import { isPinpointEnabled } from "@/lib/runtime-flags";
import { PinpointDispatcherLive } from "@/components/pinpoint/pinpoint-dispatcher-live";

export function PinpointPanel({ incidentId }: { incidentId: string | null }) {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const pinpointOn = isPinpointEnabled();
  const configured = isApiConfigured();

  const q = useQuery({
    queryKey: ["pinpoint-links", incidentId],
    enabled: Boolean(incidentId) && configured && pinpointOn,
    queryFn: () => fetchPinpointLinks(incidentId!),
    refetchInterval: 5000,
    staleTime: 3000,
  });

  const activeLinkId = useMemo(() => {
    const items = q.data ?? [];
    if (selectedLinkId && items.some((l) => l.linkId === selectedLinkId)) return selectedLinkId;
    const active = items.find((l) => l.status === "active");
    return active?.linkId ?? items[0]?.linkId ?? null;
  }, [q.data, selectedLinkId]);

  const detailQ = useQuery({
    queryKey: ["pinpoint-link-detail", incidentId, activeLinkId],
    enabled: Boolean(incidentId && activeLinkId) && configured && pinpointOn,
    queryFn: () => fetchPinpointLinkDetail(incidentId!, activeLinkId!),
    refetchInterval: 5000,
    staleTime: 2000,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!incidentId) throw new Error("No incident");
      const trimmed = phone.trim();
      if (!/^\+[1-9]\d{6,14}$/.test(trimmed)) {
        throw new Error("Enter caller phone in E.164 format (e.g. +15551234567).");
      }
      return postPinpointLink(incidentId, { callerPhoneE164: trimmed });
    },
    onSuccess: (res) => {
      setLocalErr(null);
      setPhone("");
      setSelectedLinkId(res.linkId);
      void queryClient.invalidateQueries({ queryKey: ["pinpoint-links", incidentId] });
    },
    onError: (e: Error) => setLocalErr(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: async (linkId: string) => {
      if (!incidentId) throw new Error("No incident");
      return postPinpointLinkRevoke(incidentId, linkId);
    },
    onSuccess: () => {
      setLocalErr(null);
      void queryClient.invalidateQueries({ queryKey: ["pinpoint-links", incidentId] });
      void queryClient.invalidateQueries({ queryKey: ["pinpoint-link-detail", incidentId] });
    },
    onError: (e: Error) => setLocalErr(e.message),
  });

  if (!pinpointOn) return null;

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <div className="text-[10px] font-semibold tracking-wide text-sky-400">Rapid Cortex Pinpoint</div>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">
        Send a secure SMS link for live GPS — accuracy radius, movement, and location history on this incident.
      </p>
      {!incidentId ? (
        <p className="mt-2 text-xs text-slate-500">Select an incident.</p>
      ) : !configured ? (
        <p className="mt-2 text-xs text-slate-500">API not configured.</p>
      ) : (
        <>
          {localErr ? (
            <p className="mt-2 text-xs text-rose-300" role="alert">
              {localErr}
            </p>
          ) : null}
          <div className="mt-2 flex flex-col gap-2">
            <input
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-xs text-slate-100"
              placeholder="+15551234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <button
              type="button"
              disabled={createMut.isPending}
              onClick={() => createMut.mutate()}
              className="rounded bg-red-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              {createMut.isPending ? "Sending…" : "Send Pinpoint link"}
            </button>
          </div>
          <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto text-[11px] text-slate-400">
            {(q.data ?? []).map((l) => (
              <li key={l.linkId} className="flex items-center justify-between gap-2 border-t border-slate-800/80 pt-1">
                <button
                  type="button"
                  className={`truncate text-left font-mono text-[10px] ${activeLinkId === l.linkId ? "text-sky-300" : "text-slate-400"}`}
                  onClick={() => setSelectedLinkId(l.linkId)}
                >
                  {l.linkId.slice(0, 14)}… · {l.status}
                  {l.lastPingAt ? ` · ${new Date(l.lastPingAt).toLocaleTimeString()}` : ""}
                </button>
                {l.status === "active" ? (
                  <button
                    type="button"
                    className="shrink-0 text-rose-400 underline"
                    onClick={() => revokeMut.mutate(l.linkId)}
                    disabled={revokeMut.isPending}
                  >
                    Revoke
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {detailQ.data ? <PinpointDispatcherLive detail={detailQ.data} /> : null}
        </>
      )}
    </section>
  );
}
