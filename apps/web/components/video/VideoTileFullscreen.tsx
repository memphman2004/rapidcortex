"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { VideoTileAssignment } from "rapid-cortex-shared";
import { KVSWebRTCPlayer } from "@/components/venue/KVSWebRTCPlayer";
import type { CameraApiVertical } from "@/lib/venue/venue-camera-api";
import { CameraStatusBadge } from "./CameraStatusBadge";
import { PTZController } from "./PTZController";
import { VideoDVR } from "./VideoDVR";

export function VideoTileFullscreen({
  agencyId,
  apiVertical,
  tile,
  onClose,
}: {
  agencyId: string;
  apiVertical: CameraApiVertical;
  tile: VideoTileAssignment;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"live" | "playback">("live");

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "rgba(8,6,16,0.96)" }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #1a1528" }}>
        <div>
          <div className="text-[12px] font-medium uppercase" style={{ color: "#c4b5fd" }}>
            {tile.displayName}
          </div>
          <div className="flex items-center gap-2 text-[10px]" style={{ color: "#8b7bb5" }}>
            <CameraStatusBadge status={tile.status} />
            {tile.section ? <span>Section {tile.section}</span> : null}
            {tile.buildingId ? <span>{tile.buildingId}</span> : null}
            <button
              type="button"
              className="rounded px-1.5 py-0.5"
              style={{ background: mode === "live" ? "#4c1d95" : "transparent", color: "#c4b5fd" }}
              onClick={() => setMode("live")}
            >
              LIVE
            </button>
            <button
              type="button"
              className="rounded px-1.5 py-0.5"
              style={{ background: mode === "playback" ? "#4c1d95" : "transparent", color: "#c4b5fd" }}
              onClick={() => setMode("playback")}
            >
              PLAYBACK
            </button>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" style={{ color: "#c4b5fd" }}>
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 p-4">
          <div className="h-full overflow-hidden rounded" style={{ border: "1px solid #1a1528" }}>
            {mode === "live" ? (
              <KVSWebRTCPlayer
                agencyId={agencyId}
                kvsChannelName={tile.kvsChannelName}
                displayName={tile.displayName}
                apiVertical={apiVertical}
                variant="fill"
              />
            ) : (
              <VideoDVR agencyId={agencyId} cameraId={tile.cameraId} displayName={tile.displayName} />
            )}
          </div>
        </div>
        {mode === "live" && tile.ptzCapable ? (
          <div className="w-56 shrink-0 overflow-y-auto p-4" style={{ borderLeft: "1px solid #1a1528" }}>
            <PTZController agencyId={agencyId} cameraId={tile.cameraId} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
