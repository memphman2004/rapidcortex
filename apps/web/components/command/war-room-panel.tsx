"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { WarRoom, WarRoomMessage } from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import {
  fetchWarRoom,
  fetchWarRoomMessages,
  pinWarRoomMessage,
  postWarRoomMessage,
} from "@/lib/war-room-api";

function statusBadge(status: WarRoom["status"]): string {
  if (status === "active") return "bg-emerald-950/80 text-emerald-200 ring-emerald-800";
  if (status === "standby") return "bg-amber-950/80 text-amber-200 ring-amber-800";
  return "bg-slate-800 text-slate-400 ring-slate-700";
}

export function WarRoomPanel({ roomId }: { roomId: string }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const to = useJurisdictionLink();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const roomQuery = useQuery({
    queryKey: ["war-room", roomId],
    queryFn: () => fetchWarRoom(roomId),
    refetchInterval: 5_000,
  });

  const messagesQuery = useQuery({
    queryKey: ["war-room-messages", roomId],
    queryFn: () => fetchWarRoomMessages(roomId),
    refetchInterval: 5_000,
  });

  const room = roomQuery.data;
  const items = messagesQuery.data ?? [];

  const pinned = useMemo(() => items.filter((m) => m.pinned), [items]);
  const thread = useMemo(() => items.filter((m) => !m.pinned), [items]);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.length]);

  const send = async () => {
    if (!draft.trim() || room?.status === "closed") return;
    setBusy(true);
    setError(null);
    try {
      await postWarRoomMessage(roomId, { content: draft.trim() });
      setDraft("");
      await qc.invalidateQueries({ queryKey: ["war-room-messages", roomId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  };

  const pin = async (msg: WarRoomMessage) => {
    try {
      await pinWarRoomMessage(roomId, msg.messageId);
      await qc.invalidateQueries({ queryKey: ["war-room-messages", roomId] });
      await qc.invalidateQueries({ queryKey: ["war-room", roomId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pin failed");
    }
  };

  if (roomQuery.isLoading) {
    return <p className="text-sm text-slate-500">Loading war room…</p>;
  }

  if (!room) {
    return <p className="text-sm text-rose-300">War room not found.</p>;
  }

  const activeCount = room.participants.filter((p) => p.active).length;

  return (
    <div className="flex h-full min-h-[28rem] flex-col rounded-lg border border-slate-800 bg-slate-950/60">
      <header className="border-b border-slate-800 px-3 py-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-white">{room.name}</h2>
            <Link
              href={to(`/incidents/${encodeURIComponent(room.incidentId)}/timeline`)}
              className="text-xs text-sky-400 hover:underline"
            >
              Incident {room.incidentId}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{activeCount} active</span>
            <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${statusBadge(room.status)}`}>
              {room.status}
            </span>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 md:grid-cols-[1fr_10rem]">
        <div className="flex min-h-0 flex-col border-r border-slate-800">
          {pinned.length > 0 ? (
            <div className="border-b border-amber-900/40 bg-amber-950/20 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase text-amber-300">Pinned</p>
              <ul className="mt-1 space-y-1">
                {pinned.map((m) => (
                  <li key={m.messageId} className="text-xs text-amber-100/90">
                    {m.content}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {thread.map((m) => (
              <div key={m.messageId} className="rounded border border-slate-800 bg-slate-900/50 px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-500">
                    {m.userRole} · {new Date(m.createdAt).toLocaleTimeString()}
                  </span>
                  {user?.userId === m.userId || user?.role === "agencyadmin" || user?.role === "supervisor" ? (
                    <button
                      type="button"
                      onClick={() => void pin(m)}
                      className="text-[10px] text-amber-400 hover:text-amber-300"
                    >
                      Pin
                    </button>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-slate-200 whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
          </div>

          {room.status !== "closed" ? (
            <div className="border-t border-slate-800 p-2">
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Command message…"
                  className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                />
                <button
                  type="button"
                  disabled={busy || !draft.trim()}
                  onClick={() => void send()}
                  className="rounded bg-sky-900/60 px-3 py-1.5 text-xs font-medium text-sky-100 ring-1 ring-sky-800 disabled:opacity-40"
                >
                  Send
                </button>
              </div>
              {error ? <p className="mt-1 text-xs text-rose-300">{error}</p> : null}
            </div>
          ) : (
            <p className="border-t border-slate-800 p-2 text-xs text-slate-500">Room closed — read only.</p>
          )}
        </div>

        <aside className="hidden min-h-0 overflow-y-auto p-2 md:block">
          <p className="text-[10px] font-semibold uppercase text-slate-500">Participants</p>
          <ul className="mt-2 space-y-2">
            {room.participants.map((p) => (
              <li key={p.userId} className="text-xs">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${p.active ? "bg-emerald-400" : "bg-slate-600"}`}
                  />
                  <span className="font-mono text-slate-300">{p.userId.slice(0, 8)}…</span>
                </div>
                <span className="text-[10px] text-slate-500">{p.role}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
