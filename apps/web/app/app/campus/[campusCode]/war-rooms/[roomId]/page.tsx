"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { WarRoomPanel } from "@/components/command/war-room-panel";
import { fetchWarRoom, joinWarRoom, isWarRoomApiConfigured } from "@/lib/war-room-api";
import { isWarRoomsEnabled } from "@/lib/runtime-flags";

export default function CampusWarRoomPage() {
  const params = useParams<{ campusCode: string; roomId: string }>();
  const campusCode = String(params.campusCode ?? "").toUpperCase();
  const roomId = params.roomId;
  const enabled = isWarRoomsEnabled() && isWarRoomApiConfigured() && Boolean(roomId);
  const incidentsHref = `/app/campus/${encodeURIComponent(campusCode)}/incidents`;
  const listHref = `/app/campus/${encodeURIComponent(campusCode)}/war-rooms`;

  const roomQuery = useQuery({
    queryKey: ["war-room", roomId],
    queryFn: () => fetchWarRoom(roomId),
    enabled,
  });

  useEffect(() => {
    if (!enabled || !roomId) return;
    void joinWarRoom(roomId).catch(() => undefined);
  }, [enabled, roomId]);

  if (!enabled) {
    return (
      <div className="p-6 text-sm text-slate-400">
        War rooms aren’t enabled for this agency. Contact Rapid Cortex support.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-white">Campus war room</h1>
          <p className="text-xs text-slate-500">In-platform command thread — not a 911 CAD console.</p>
        </div>
        <Link href={listHref} className="text-xs text-sky-400 hover:underline">
          ← All war rooms
        </Link>
      </div>
      {roomQuery.data?.incidentId ? (
        <p className="text-xs text-slate-400">
          Incident{" "}
          <Link href={incidentsHref} className="text-sky-400 hover:underline">
            {roomQuery.data.incidentId}
          </Link>
        </p>
      ) : null}
      <WarRoomPanel roomId={roomId} incidentHref={incidentsHref} />
    </div>
  );
}
