"use client";

import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Incident } from "rapid-cortex-shared";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import {
  createWarRoom,
  fetchWarRooms,
  joinWarRoom,
  isWarRoomApiConfigured,
} from "@/lib/war-room-api";
import { isWarRoomsEnabled } from "@/lib/runtime-flags";

function isHighPriority(i: Incident): boolean {
  return i.urgency === "critical" || i.urgency === "high";
}

function isActive(i: Incident): boolean {
  return i.status === "active" || i.status === "in_progress";
}

export function WarRoomLauncher({ incident }: { incident: Incident }) {
  const router = useRouter();
  const to = useJurisdictionLink();
  const qc = useQueryClient();
  const enabled =
    isWarRoomsEnabled() && isWarRoomApiConfigured() && isHighPriority(incident) && isActive(incident);

  const roomsQuery = useQuery({
    queryKey: ["war-rooms", incident.incidentId],
    queryFn: () => fetchWarRooms(incident.incidentId),
    enabled,
    refetchInterval: 15_000,
  });

  if (!enabled) return null;

  const activeRoom = (roomsQuery.data ?? []).find((r) => r.status === "active" || r.status === "standby");
  const participantCount = activeRoom?.participants.filter((p) => p.active).length ?? 0;

  const open = async () => {
    try {
      let roomId = activeRoom?.roomId;
      if (!roomId) {
        const created = await createWarRoom({
          incidentId: incident.incidentId,
          name: `${incident.title || incident.incidentId} — Command`,
        });
        roomId = created.roomId;
      } else {
        await joinWarRoom(roomId);
      }
      await qc.invalidateQueries({ queryKey: ["war-rooms", incident.incidentId] });
      router.push(to(`/command/war-room/${encodeURIComponent(roomId)}`));
    } catch {
      // surfaced on destination page if navigation still occurs
    }
  };

  return (
    <button
      type="button"
      onClick={() => void open()}
      className="relative rounded-md bg-violet-950/60 px-2 py-1 text-xs font-medium text-violet-100 ring-1 ring-violet-800 hover:bg-violet-900/50"
    >
      Open War Room
      {participantCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-500 px-1 text-[9px] font-bold text-white">
          {participantCount}
        </span>
      ) : null}
    </button>
  );
}
