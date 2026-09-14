"use client";

import { Expand, Move } from "lucide-react";
import type { VideoTileAssignment } from "rapid-cortex-shared";
import { CameraStatusBadge } from "./CameraStatusBadge";

export function VideoTileOverlay({
  tile,
  onFullscreen,
}: {
  tile: VideoTileAssignment;
  onFullscreen: () => void;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex flex-col justify-between p-2"
      style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.72) 0%, transparent 28%, transparent 72%, rgba(0,0,0,0.55) 100%)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "#c4b5fd" }}>
            {tile.displayName}
          </div>
          <CameraStatusBadge status={tile.status} />
        </div>
        <div className="pointer-events-auto flex gap-1">
          {tile.ptzCapable ? (
            <span className="rounded px-1 py-0.5 text-[9px]" style={{ color: "#8b7bb5", background: "rgba(0,0,0,0.45)" }}>
              <Move className="inline h-3 w-3" /> PTZ
            </span>
          ) : null}
          <button
            type="button"
            aria-label="Fullscreen"
            className="rounded p-1"
            style={{ color: "#c4b5fd", background: "rgba(0,0,0,0.45)" }}
            onClick={onFullscreen}
          >
            <Expand className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
