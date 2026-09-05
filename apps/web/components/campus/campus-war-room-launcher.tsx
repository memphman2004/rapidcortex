"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createWarRoom,
  fetchWarRooms,
  joinWarRoom,
  isWarRoomApiConfigured,
} from "@/lib/war-room-api";
import { isWarRoomsEnabled } from "@/lib/runtime-flags";
import { useSession } from "@/components/auth/session-context";

export function CampusWarRoomLauncher({
  campusCode,
  incidentId,
  incidentType,
  openWarRoom,
}: {
  campusCode: string;
  incidentId: string;
  incidentType: string;
  openWarRoom?: boolean;
}) {
  const { user } = useSession();
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const role = (user?.role ?? "").trim().toUpperCase();
  const canOpen =
    role === "CAMPUS_ADMIN" ||
    role === "CAMPUS_SUPERVISOR" ||
    role === "RCSUPERADMIN" ||
    role === "RCADMIN";
  const suggested = openWarRoom || incidentType === "active_threat";
  const enabled = canOpen && isWarRoomsEnabled() && isWarRoomApiConfigured() && suggested;

  const roomsQuery = useQuery({
    queryKey: ["war-rooms", incidentId],
    queryFn: () => fetchWarRooms(incidentId),
    enabled,
    refetchInterval: 15_000,
  });

  if (!enabled) return null;

  const activeRoom = (roomsQuery.data ?? []).find((r) => r.status === "active" || r.status === "standby");
  const hrefBase = `/app/campus/${encodeURIComponent(campusCode)}/war-rooms`;

  const open = async () => {
    setError(null);
    try {
      let roomId = activeRoom?.roomId;
      if (!roomId) {
        const created = await createWarRoom({
          incidentId,
          name: `${incidentId} — Campus command`,
        });
        roomId = created.roomId;
      } else {
        await joinWarRoom(roomId);
      }
      await qc.invalidateQueries({ queryKey: ["war-rooms", incidentId] });
      router.push(`${hrefBase}/${encodeURIComponent(roomId)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open war room");
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void open()}
        className="rounded-md bg-violet-950/60 px-2 py-1 text-xs font-medium text-violet-100 ring-1 ring-violet-800 hover:bg-violet-900/50"
      >
        {activeRoom ? "Open war room" : "Open campus war room"}
      </button>
      {error ? <p className="max-w-[14rem] text-[10px] text-rose-300">{error}</p> : null}
    </div>
  );
}
