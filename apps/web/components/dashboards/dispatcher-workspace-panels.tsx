"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import type { Incident } from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import { CallerMediaGallery } from "@/components/dispatch/caller-media-gallery";
import {
  deleteCallerMedia,
  fetchCallerMedia,
  isCallerMediaApiConfigured,
  postCallerMediaSendLink,
} from "@/lib/caller-media-api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isIncidentMediaEnabled } from "@/lib/runtime-flags";
import { StatusBadge } from "./status-badge";

export function LiveCallWorkspace({ children }: { children: React.ReactNode }) {
  return (
    <section
      id="overview"
      className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm shadow-black/20"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Live call workspace</h2>
        <StatusBadge tone="active" />
      </div>
      {children}
    </section>
  );
}

export function AiSummaryPanel() {
  return (
    <article
      id="ai-summary"
      className="rounded-lg border border-cyan-900/40 bg-cyan-950/15 p-3"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">AI summary</h3>
        <StatusBadge tone="ai_suggested" />
      </div>
      <p className="text-xs text-slate-300">
        Suggestion only: Two-vehicle collision with possible injuries. Caller reports one occupant
        trapped. Dispatcher must verify key facts before CAD submission.
      </p>
    </article>
  );
}

export function TranscriptionPanel() {
  return (
    <article id="transcription" className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <h3 className="mb-2 text-sm font-medium text-white">Live transcription</h3>
      <p className="text-xs text-slate-300">
        Caller: &ldquo;We spun out near the bridge. I think someone is hurt.&rdquo;
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Dispatcher: &ldquo;Stay calm. Confirm your exact location and if anyone is trapped.&rdquo;
      </p>
    </article>
  );
}

export function TranslationPanel() {
  return (
    <article id="translation" className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <h3 className="mb-2 text-sm font-medium text-white">Translation</h3>
      <p className="text-xs text-slate-400">
        English output is active. Use text-only mode if caller cannot safely speak.
      </p>
    </article>
  );
}

export function CallerInfoPanel() {
  return (
    <article
      id="caller-information"
      className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
    >
      <h3 className="mb-2 text-sm font-medium text-white">Caller information</h3>
      <dl className="space-y-1 text-xs text-slate-300">
        <div className="flex justify-between gap-2">
          <dt className="text-slate-400">Location</dt>
          <dd>Bridge approach, mile 14</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-400">Callback</dt>
          <dd>(555) 013-4491</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-400">Priority</dt>
          <dd>P1</dd>
        </div>
      </dl>
    </article>
  );
}

export function CallerMediaPanel({ incidentId }: { incidentId?: string | null }) {
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

  if (!isIncidentMediaEnabled() || !isCallerMediaApiConfigured()) {
    return (
      <article id="caller-media" className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
        <h3 className="mb-2 text-sm font-medium text-white">Caller text / photo / video</h3>
        <p className="text-xs text-slate-400">Caller media is disabled in this environment.</p>
      </article>
    );
  }

  if (!incidentId) {
    return (
      <article id="caller-media" className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
        <h3 className="mb-2 text-sm font-medium text-white">Caller text / photo / video</h3>
        <p className="text-xs text-slate-400">Select an active incident to request caller media.</p>
      </article>
    );
  }

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
    <article id="caller-media" className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <h3 className="mb-2 text-sm font-medium text-white">Caller text / photo / video</h3>
      <p className="text-xs text-slate-400">
        Safety-first links only. Do not request media if it increases caller risk.
      </p>
      <p className="mt-1 text-[10px] text-slate-500">All media requests and uploads are audit logged.</p>

      {user?.role === "dispatcher" || user?.role === "supervisor" || user?.role === "agencyadmin" ? (
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
        {mediaQuery.data ? (
          <CallerMediaGallery incidentId={incidentId} items={mediaQuery.data} onDelete={onDelete} />
        ) : null}
      </div>
    </article>
  );
}

function cadVendorLabel(c: Incident["cadSystem"] | undefined): string {
  if (c === "motorola") return "PremierOne";
  if (c === "tyler") return "Tyler";
  if (c === "centralsquare") return "CentralSquare";
  if (c === "hexagon") return "Hexagon";
  if (c === "generic") return "CAD";
  return "CAD";
}

function formatCadSync(iso: string | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const m = Math.max(1, Math.round((Date.now() - t) / 60_000));
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export function CadReadyPanel({ incident }: { incident?: Incident | null }) {
  const to = useJurisdictionLink();
  const i = incident ?? null;
  const live = Boolean(i && i.source === "cad");

  if (!live) {
    return (
      <article id="cad-entry" className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">CAD-ready panel</h3>
          <StatusBadge tone="pending" />
        </div>
        <p className="text-xs text-slate-300">
          CAD payload prepared. Dispatcher review is required before submission unless agency automation policy permits
          otherwise.
        </p>
      </article>
    );
  }

  return (
    <article id="cad-entry" className="rounded-lg border border-emerald-900/40 bg-emerald-950/15 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-white">CAD-ready panel</h3>
        <span className="flex items-center gap-1.5 rounded-full border border-emerald-600/50 bg-emerald-600/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          CAD live
        </span>
      </div>
      <dl className="space-y-1 text-xs text-slate-300">
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">CAD #</dt>
          <dd className="font-mono text-slate-100">{i!.cadIncidentId ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">Vendor</dt>
          <dd>{cadVendorLabel(i!.cadSystem)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">Last sync</dt>
          <dd>{formatCadSync(i!.cadLastSyncAt)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">Units</dt>
          <dd className="max-w-[12rem] truncate text-right text-slate-200">{(i!.cadUnits ?? []).join(", ") || "—"}</dd>
        </div>
      </dl>
      <Link
        href={`${to("/cad")}?incident=${encodeURIComponent(i!.incidentId)}`}
        className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-emerald-600/50 bg-emerald-600/20 py-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-50 hover:bg-emerald-600/30"
      >
        Open CAD entry
      </Link>
    </article>
  );
}

export function ManualModeButton() {
  return (
    <button
      type="button"
      className="rounded-md border border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-xs font-medium text-indigo-100 hover:bg-indigo-500/20"
    >
      Manual mode
    </button>
  );
}

export function SupervisorAssistPanel() {
  return (
    <article
      id="supervisor-assist"
      className="rounded-lg border border-violet-900/40 bg-violet-950/20 p-3"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">Supervisor assist</h3>
        <StatusBadge tone="supervisor_watching" />
      </div>
      <p className="text-xs text-slate-300">
        Silent monitor available. Supervisor entry and assist actions must be audit logged.
      </p>
    </article>
  );
}
