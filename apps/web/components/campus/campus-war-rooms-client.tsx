"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { WarRoom } from "rapid-cortex-shared";
import { createWarRoom, fetchWarRooms, isWarRoomApiConfigured } from "@/lib/war-room-api";
import { isWarRoomsEnabled } from "@/lib/runtime-flags";

function activeCount(room: WarRoom): number {
  return room.participants.filter((p) => p.active).length;
}

function statusBadge(status: WarRoom["status"]): string {
  if (status === "active") return "bg-emerald-950/80 text-emerald-200 ring-emerald-800";
  if (status === "standby") return "bg-amber-950/80 text-amber-200 ring-amber-800";
  return "bg-slate-800 text-slate-400 ring-slate-700";
}

export function CampusWarRoomsClient({ campusCode }: { campusCode: string }) {
  const code = campusCode.toUpperCase();
  const qc = useQueryClient();
  const [incidentId, setIncidentId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const enabled = isWarRoomsEnabled() && isWarRoomApiConfigured();
  const base = `/app/campus/${encodeURIComponent(code)}/war-rooms`;

  const roomsQuery = useQuery({
    queryKey: ["war-rooms", "campus", code],
    queryFn: () => fetchWarRooms(),
    enabled,
    refetchInterval: 15_000,
  });

  const rooms = roomsQuery.data ?? [];
  const { openRooms, closedRooms } = useMemo(() => {
    const open: WarRoom[] = [];
    const closed: WarRoom[] = [];
    for (const room of rooms) {
      if (room.status === "closed") closed.push(room);
      else open.push(room);
    }
    return { openRooms: open, closedRooms: closed };
  }, [rooms]);

  if (!isWarRoomsEnabled()) {
    return (
      <p className="text-sm text-slate-400">
        War rooms aren’t enabled for this agency. Contact Rapid Cortex support.
      </p>
    );
  }

  const create = async () => {
    const id = incidentId.trim();
    if (!id) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createWarRoom({
        incidentId: id,
        name: `${id} — Campus command`,
      });
      await qc.invalidateQueries({ queryKey: ["war-rooms"] });
      window.location.assign(`${base}/${encodeURIComponent(created.roomId)}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create war room");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-400">
        In-platform command threads for campus incidents. Microsoft Teams is optional and not required.
        This is not a 911 CAD war room.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-400">
          Campus incident ID
          <input
            className="mt-1 block rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white"
            value={incidentId}
            onChange={(e) => setIncidentId(e.target.value)}
            placeholder="INC-…"
          />
        </label>
        <button
          type="button"
          disabled={creating || !incidentId.trim()}
          onClick={() => void create()}
          className="rounded bg-violet-950/70 px-3 py-1.5 text-xs font-medium text-violet-100 ring-1 ring-violet-800 disabled:opacity-40"
        >
          {creating ? "Creating…" : "Open war room"}
        </button>
      </div>
      {createError ? <p className="text-sm text-rose-300">{createError}</p> : null}
      {roomsQuery.isLoading ? (
        <p className="text-sm text-slate-500">Loading war rooms…</p>
      ) : openRooms.length === 0 ? (
        <p className="text-sm text-slate-500">No open campus war rooms.</p>
      ) : (
        <div className="space-y-2">
          {openRooms.map((room) => (
            <div
              key={room.roomId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-white">{room.name}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Incident {room.incidentId} · {activeCount(room)} participant
                  {activeCount(room) === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${statusBadge(room.status)}`}>
                  {room.status}
                </span>
                <Link
                  href={`${base}/${encodeURIComponent(room.roomId)}`}
                  className="rounded bg-sky-900/60 px-3 py-1.5 text-xs font-medium text-sky-100 ring-1 ring-sky-800"
                >
                  Open
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      {closedRooms.length > 0 ? (
        <p className="text-xs text-slate-500">{closedRooms.length} closed room(s).</p>
      ) : null}
    </div>
  );
}
