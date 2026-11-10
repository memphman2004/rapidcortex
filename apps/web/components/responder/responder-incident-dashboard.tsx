"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Incident, TranscriptSegment } from "rapid-cortex-shared";
import { IncidentContextMap } from "@/components/dispatch/incident-context-map";
import { TranscriptPanel } from "@/components/dispatch/transcript-panel";
import { useSession } from "@/components/auth/session-context";
import { isApiConfigured } from "@/lib/api";
import { isIqResponderEnabled } from "@/lib/runtime-flags";

type UnitAssignment = { unitId?: string; callSign?: string; userId?: string; assignedUserId?: string };

async function fetchIncident(incidentId: string): Promise<Incident | null> {
  const res = await fetch(`/api/incidents/${encodeURIComponent(incidentId)}`, {
    credentials: "same-origin",
  });
  if (!res.ok) return null;
  return res.json() as Promise<Incident>;
}

async function fetchTranscript(incidentId: string): Promise<TranscriptSegment[]> {
  const res = await fetch(`/api/incidents/${encodeURIComponent(incidentId)}/transcript`, {
    credentials: "same-origin",
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { segments?: TranscriptSegment[] } | TranscriptSegment[];
  return Array.isArray(body) ? body : (body.segments ?? []);
}

function userOnAssignment(userId: string | undefined, units: UnitAssignment[]): boolean {
  if (!userId) return false;
  return units.some(
    (u) => u.userId === userId || u.assignedUserId === userId || u.unitId === userId,
  );
}

/**
 * Read-only iQ Responder dashboard: map, transcript, units, Listen In (KVS).
 */
export function ResponderIncidentDashboard({ incidentId }: { incidentId: string }) {
  const { user } = useSession();
  const [audioAuthorized, setAudioAuthorized] = useState(false);
  const [streamArn, setStreamArn] = useState<string | null>(null);
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const [listenError, setListenError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const incidentQ = useQuery({
    queryKey: ["responder-incident", incidentId],
    queryFn: () => fetchIncident(incidentId),
    enabled: isIqResponderEnabled() && isApiConfigured(),
    refetchInterval: 15_000,
  });

  const transcriptQ = useQuery({
    queryKey: ["responder-transcript", incidentId],
    queryFn: () => fetchTranscript(incidentId),
    enabled: isIqResponderEnabled() && isApiConfigured(),
    refetchInterval: 5_000,
  });

  const incident = incidentQ.data;
  const units = useMemo((): UnitAssignment[] => {
    const details = incident?.cadUnitDetails ?? [];
    if (details.length > 0) {
      return details.map((d) => ({
        unitId: d.unitId,
        callSign: d.callSign,
        userId: (d as { userId?: string }).userId,
        assignedUserId: (d as { assignedUserId?: string }).assignedUserId,
      }));
    }
    return (incident?.cadUnits ?? []).map((id) => ({ unitId: id, callSign: id }));
  }, [incident]);

  const canListen =
    userOnAssignment(user?.userId, units) ||
    Boolean(user?.userId && incident?.cadUnits?.includes(user.userId));

  useEffect(() => {
    if (!isIqResponderEnabled()) return;
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL?.trim();
    if (!wsUrl) return;
    let closed = false;
    const connect = async () => {
      try {
        const tokenRes = await fetch("/api/call-control/ws-token", { credentials: "same-origin" });
        const token = tokenRes.ok ? ((await tokenRes.json()) as { token?: string }).token : undefined;
        const url = token ? `${wsUrl}?token=${encodeURIComponent(token)}` : wsUrl;
        const ws = new WebSocket(url);
        wsRef.current = ws;
        ws.onopen = () => {
          ws.send(JSON.stringify({ action: "responder-subscribe", incidentId }));
        };
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(String(ev.data)) as {
              type?: string;
              data?: { streamArn?: string | null; audioStreamUnavailable?: boolean };
            };
            if (msg.type === "audio_authorized") {
              setAudioAuthorized(true);
              setStreamArn(msg.data?.streamArn ?? null);
              setAudioUnavailable(Boolean(msg.data?.audioStreamUnavailable) || !msg.data?.streamArn);
            }
            if (msg.type === "incident_update") {
              void incidentQ.refetch();
            }
          } catch {
            /* ignore */
          }
        };
      } catch {
        /* fail-soft */
      }
    };
    void connect();
    return () => {
      closed = true;
      wsRef.current?.close();
      wsRef.current = null;
      void closed;
    };
  }, [incidentId, incidentQ]);

  const startListenIn = useCallback(async () => {
    setListenError(null);
    if (!audioAuthorized) {
      setListenError("Awaiting dispatcher audio authorization.");
      return;
    }
    if (audioUnavailable || !streamArn) {
      setListenError("Audio stream unavailable.");
      return;
    }
    try {
      // KVS WebRTC viewer is environment-specific; fail-soft with HTMLAudioElement sink routing.
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = streamArn.startsWith("http") ? streamArn : "";
      const sinkId = (audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }).setSinkId;
      if (typeof sinkId === "function") {
        try {
          await sinkId.call(audio, "default");
        } catch {
          /* OS Bluetooth / default output */
        }
      }
      if (audio.src) await audio.play();
      else setListenError("Stream ARN present but playback URL not configured in this environment.");
    } catch (err) {
      setListenError(err instanceof Error ? err.message : "Listen In failed");
    }
  }, [audioAuthorized, audioUnavailable, streamArn]);

  const lat =
    (typeof incident?.callerLocationLat === "number" ? incident.callerLocationLat : undefined) ??
    incident?.cadCoordinates?.lat;
  const lng =
    (typeof incident?.callerLocationLng === "number" ? incident.callerLocationLng : undefined) ??
    incident?.cadCoordinates?.lng;

  if (!isIqResponderEnabled()) {
    return <p className="p-6 text-sm text-slate-400">iQ Responder is disabled.</p>;
  }

  return (
    <main className="min-h-screen bg-[#0f1117] text-slate-100">
      <header className="border-b border-slate-800 bg-[#0b1118] px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">iQ Responder</p>
            <h1 className="text-lg font-semibold">{incident?.title ?? incidentId}</h1>
            <p className="mt-1 text-sm text-slate-400">
              {incident?.cadNatureCode ?? incident?.category ?? "—"} · Priority{" "}
              {incident?.cadPriority ?? incident?.urgency ?? "—"} ·{" "}
              {incident?.cadLocation ?? incident?.callerAddressLine ?? "Address pending"} ·{" "}
              {incident?.status ?? "—"}
            </p>
          </div>
          {canListen ? (
            <button
              type="button"
              onClick={() => void startListenIn()}
              className="rounded-md bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-600"
            >
              Listen In
            </button>
          ) : (
            <span className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-500">
              Listen In unavailable — not assigned to this incident
            </span>
          )}
        </div>
        {listenError ? <p className="mt-2 text-xs text-amber-300">{listenError}</p> : null}
        <audio ref={audioRef} className="hidden" />
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-slate-800">
          <h2 className="border-b border-slate-800 bg-[#0b1118] px-3 py-2 text-xs uppercase text-slate-500">
            Map
          </h2>
          {lat != null && lng != null ? (
            <IncidentContextMap
              latitude={lat}
              longitude={lng}
              label={incident?.cadLocation ?? "Incident"}
              incidentId={incidentId}
              fill={false}
            />
          ) : (
            <p className="p-4 text-sm text-slate-500">No map coordinates yet.</p>
          )}
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-800">
          <h2 className="border-b border-slate-800 bg-[#0b1118] px-3 py-2 text-xs uppercase text-slate-500">
            Live transcript
          </h2>
          <div className="h-64">
            <TranscriptPanel
              segments={transcriptQ.data ?? []}
              autoScroll
              onAutoScrollChange={() => {}}
              isStreaming={false}
              isLoading={transcriptQ.isLoading}
              className="!h-full !min-h-0 !border-0 !bg-transparent"
            />
          </div>
        </section>

        <section className="rounded-lg border border-slate-800 lg:col-span-2">
          <h2 className="border-b border-slate-800 bg-[#0b1118] px-3 py-2 text-xs uppercase text-slate-500">
            Unit assignments
          </h2>
          <ul className="divide-y divide-slate-800 text-sm">
            {units.length === 0 ? (
              <li className="px-3 py-3 text-slate-500">No units assigned.</li>
            ) : (
              units.map((u, i) => (
                <li key={`${u.unitId ?? u.callSign ?? i}`} className="flex justify-between px-3 py-2">
                  <span>{u.callSign ?? u.unitId ?? "Unit"}</span>
                  <span className="text-slate-500">{u.userId ?? u.assignedUserId ?? ""}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
