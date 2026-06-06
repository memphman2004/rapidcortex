"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSession } from "@/components/auth/session-context";
import { CallerMediaGallery } from "@/components/dispatch/caller-media-gallery";
import {
  deleteCallerMedia,
  fetchCallerMedia,
  isCallerMediaApiConfigured,
  postCallerMediaSendLink,
} from "@/lib/caller-media-api";
import { isIncidentMediaEnabled } from "@/lib/runtime-flags";

export function IncidentMediaPanel({ incidentId }: { incidentId: string | null }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [showPhone, setShowPhone] = useState<"photo" | "video" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabled =
    Boolean(incidentId) &&
    isIncidentMediaEnabled() &&
    isCallerMediaApiConfigured() &&
    Boolean(user && user.role !== "auditor");

  const mediaQuery = useQuery({
    queryKey: ["caller-media", incidentId],
    queryFn: () => fetchCallerMedia(incidentId!),
    enabled,
    refetchInterval: (q) => {
      const pending = (q.state.data ?? []).some(
        (r) => r.status === "link_sent" || r.status === "upload_url_issued" || r.status === "pending",
      );
      return pending ? 8000 : false;
    },
  });

  if (!isIncidentMediaEnabled() || !isCallerMediaApiConfigured()) return null;
  if (!incidentId || !user || user.role === "auditor") return null;

  const canSendLink =
    user.role === "dispatcher" || user.role === "supervisor" || user.role === "agencyadmin";

  const sendLink = async (mediaType: "photo" | "video") => {
    if (!phone.trim()) {
      setError("Enter caller phone in E.164 format (e.g. +15551234567).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await postCallerMediaSendLink(incidentId, { callerPhone: phone.trim(), mediaType });
      setShowPhone(null);
      await qc.invalidateQueries({ queryKey: ["caller-media", incidentId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send link failed");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (mediaId: string) => {
    setBusy(true);
    try {
      await deleteCallerMedia(incidentId, mediaId);
      await qc.invalidateQueries({ queryKey: ["caller-media", incidentId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Caller media</h3>
      </div>
      <p className="mt-1 text-[10px] text-slate-500">All media requests and uploads are audit logged.</p>

      {canSendLink ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowPhone("photo")}
            className="rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-sky-300 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-40"
          >
            Send photo link
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowPhone("video")}
            className="rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-sky-300 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-40"
          >
            Send video link
          </button>
        </div>
      ) : null}

      {showPhone ? (
        <div className="mt-2 space-y-2 rounded border border-slate-800 bg-slate-900/50 p-2">
          <label className="block text-[10px] text-slate-400">
            Caller mobile (E.164)
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+15551234567"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void sendLink(showPhone)}
              className="rounded bg-teal-950/80 px-2 py-1 text-xs text-teal-100 ring-1 ring-teal-800 disabled:opacity-40"
            >
              Send SMS
            </button>
            <button type="button" onClick={() => setShowPhone(null)} className="text-xs text-slate-500">
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-xs text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-3 border-t border-slate-800 pt-3">
        {mediaQuery.isLoading ? <p className="text-xs text-slate-500">Loading media…</p> : null}
        {mediaQuery.isError ? (
          <p className="text-xs text-rose-300">
            {mediaQuery.error instanceof Error ? mediaQuery.error.message : "Failed to load"}
          </p>
        ) : null}
        {mediaQuery.data ? (
          <CallerMediaGallery incidentId={incidentId} items={mediaQuery.data} onDelete={onDelete} />
        ) : null}
      </div>
    </div>
  );
}
