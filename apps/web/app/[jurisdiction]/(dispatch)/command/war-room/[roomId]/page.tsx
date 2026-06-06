"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { IncidentTimeline } from "@/components/dispatch/timeline/incident-timeline";
import { WarRoomCommandSidebar } from "@/components/command/war-room-command-sidebar";
import { WarRoomPanel } from "@/components/command/war-room-panel";
import { CreateStakeholderPageButton } from "@/components/command/stakeholder-page-builder";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { fetchWarRoom, joinWarRoom, isWarRoomApiConfigured } from "@/lib/war-room-api";
import { isWarRoomsEnabled, isStakeholderPagesEnabled } from "@/lib/runtime-flags";

export default function WarRoomPage() {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;
  const to = useJurisdictionLink();

  const enabled = isWarRoomsEnabled() && isWarRoomApiConfigured() && Boolean(roomId);

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
        War rooms are disabled. Set <code className="text-slate-300">NEXT_PUBLIC_ENABLE_WAR_ROOMS=1</code>.
      </div>
    );
  }

  const incidentId = roomQuery.data?.incidentId;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-white">War room command</h1>
          <p className="text-xs text-slate-500">Collaborative major-incident workspace — messages poll every 5s.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isStakeholderPagesEnabled() && incidentId ? (
            <CreateStakeholderPageButton incidentId={incidentId} />
          ) : null}
          <Link href={to("/review")} className="text-xs text-sky-400 hover:underline">
            ← Supervisor overview
          </Link>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-3">
        <div className="min-h-[24rem] overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40 p-2 lg:col-span-1">
          {incidentId ? <IncidentTimeline incidentId={incidentId} /> : <p className="p-4 text-xs text-slate-500">Loading incident…</p>}
        </div>
        <div className="min-h-[24rem] lg:col-span-1">
          <WarRoomPanel roomId={roomId} />
        </div>
        <div className="min-h-[24rem] lg:col-span-1">
          {incidentId ? <WarRoomCommandSidebar incidentId={incidentId} /> : null}
        </div>
      </div>
    </div>
  );
}
