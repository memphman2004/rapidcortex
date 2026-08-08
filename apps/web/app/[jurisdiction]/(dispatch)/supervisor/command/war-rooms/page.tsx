"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Radio } from "lucide-react";
import type { WarRoom } from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { createWarRoom, fetchWarRooms, isWarRoomApiConfigured } from "@/lib/war-room-api";
import { isWarRoomsEnabled } from "@/lib/runtime-flags";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "../../_components/supervisor-access";

function canAccessWarRooms(role: string | null | undefined): boolean {
  return isSupervisorOrStaffRole(role) || role === "agencyadmin";
}

function activeCount(room: WarRoom): number {
  return room.participants.filter((p) => p.active).length;
}

function statusBadge(status: WarRoom["status"]): string {
  if (status === "active") return "bg-emerald-950/80 text-emerald-200 ring-emerald-800";
  if (status === "standby") return "bg-amber-950/80 text-amber-200 ring-amber-800";
  return "bg-slate-800 text-slate-400 ring-slate-700";
}

function RoomRow({ room, to }: { room: WarRoom; to: (path: string) => string }) {
  const count = activeCount(room);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-white">{room.name}</p>
          <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${statusBadge(room.status)}`}>
            {room.status}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <Link
            href={to(`/incidents/${encodeURIComponent(room.incidentId)}/timeline`)}
            className="text-sky-400 hover:underline"
          >
            Incident {room.incidentId}
          </Link>
          <span>
            {count} participant{count === 1 ? "" : "s"}
          </span>
        </div>
      </div>
      <Link
        href={to(`/command/war-room/${encodeURIComponent(room.roomId)}`)}
        className="rounded bg-sky-900/60 px-3 py-1.5 text-xs font-medium text-sky-100 ring-1 ring-sky-800 hover:bg-sky-900/80"
      >
        Open
      </Link>
    </div>
  );
}

function SupervisorWarRoomsPageInner() {
  const { user } = useSession();
  const to = useJurisdictionLink();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const incidentIdParam = searchParams.get("incidentId")?.trim() || undefined;
  const [closedOpen, setClosedOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const enabled = isWarRoomsEnabled() && isWarRoomApiConfigured();

  const roomsQuery = useQuery({
    queryKey: ["war-rooms", "agency"],
    queryFn: () => fetchWarRooms(),
    enabled: enabled && canAccessWarRooms(user?.role),
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

  if (!canAccessWarRooms(user?.role)) {
    return <SupervisorAccessRestricted />;
  }

  if (!isWarRoomsEnabled()) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pb-10">
        <h1 className="text-xl font-semibold text-white">War Rooms</h1>
        <p className="text-sm text-slate-400">
          War rooms aren’t enabled for this agency. Contact Rapid Cortex support.
        </p>
      </div>
    );
  }

  const createFromIncident = async () => {
    if (!incidentIdParam) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createWarRoom({
        incidentId: incidentIdParam,
        name: `${incidentIdParam} — Command`,
      });
      await qc.invalidateQueries({ queryKey: ["war-rooms"] });
      window.location.assign(to(`/command/war-room/${encodeURIComponent(created.roomId)}`));
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create war room");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">War Rooms</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Coordinate major incidents with live command threads and participant presence.
          </p>
        </div>
        {incidentIdParam ? (
          <button
            type="button"
            disabled={creating}
            onClick={() => void createFromIncident()}
            className="rounded bg-violet-950/70 px-3 py-1.5 text-xs font-medium text-violet-100 ring-1 ring-violet-800 hover:bg-violet-900/60 disabled:opacity-40"
          >
            {creating ? "Creating…" : `Create for ${incidentIdParam}`}
          </button>
        ) : null}
      </div>

      {createError ? <p className="text-sm text-rose-300">{createError}</p> : null}

      {roomsQuery.isLoading ? (
        <p className="text-sm text-slate-500">Loading war rooms…</p>
      ) : roomsQuery.isError ? (
        <p className="text-sm text-rose-300">
          {roomsQuery.error instanceof Error ? roomsQuery.error.message : "Failed to load war rooms"}
        </p>
      ) : openRooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-950/40 py-16 text-center">
          <Radio className="mb-4 h-10 w-10 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-300">No active war rooms</h2>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            Open a war room from an escalated incident on Review, or from the console War Rooms card.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {openRooms.map((room) => (
            <RoomRow key={room.roomId} room={room} to={to} />
          ))}
        </div>
      )}

      {closedRooms.length > 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950/30">
          <button
            type="button"
            onClick={() => setClosedOpen((v) => !v)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-slate-300 hover:bg-slate-900/40"
          >
            {closedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Closed rooms ({closedRooms.length})
          </button>
          {closedOpen ? (
            <div className="space-y-2 border-t border-slate-800 px-4 py-3">
              {closedRooms.map((room) => (
                <RoomRow key={room.roomId} room={room} to={to} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function SupervisorWarRoomsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm text-slate-500">Loading war rooms…</div>
      }
    >
      <SupervisorWarRoomsPageInner />
    </Suspense>
  );
}
