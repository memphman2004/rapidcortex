"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import type { VideoTileAssignment } from "rapid-cortex-shared";
import { CameraStatusBadge } from "./CameraStatusBadge";

export function VideoWallSidebar({
  cameras,
  onAssign,
}: {
  cameras: VideoTileAssignment[];
  onAssign: (cameraId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <aside
      className="flex shrink-0 flex-col"
      style={{
        width: open ? 240 : 36,
        background: "#100e1e",
        borderRight: "1px solid #1a1528",
      }}
    >
      <button
        type="button"
        className="flex h-12 items-center justify-center"
        style={{ borderBottom: "1px solid #1a1528", color: "#c4b5fd" }}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Collapse camera list" : "Expand camera list"}
      >
        {open ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open ? (
        <ul className="flex-1 overflow-y-auto p-2 text-[11px]">
          {cameras.map((cam) => (
            <li key={cam.cameraId}>
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/camera-id", cam.cameraId);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => onAssign(cam.cameraId)}
                className="mb-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left"
                style={{ color: "#c4b5fd" }}
              >
                <GripVertical className="h-3 w-3 shrink-0" style={{ color: "#6b5f87" }} />
                <span className="min-w-0 flex-1 truncate">{cam.displayName}</span>
                <CameraStatusBadge status={cam.status} />
              </button>
            </li>
          ))}
          {cameras.length === 0 ? (
            <li className="px-2 py-4" style={{ color: "#6b5f87" }}>
              No cameras in the registry. Add ONVIF/RTSP cameras on the Cameras page.
            </li>
          ) : null}
        </ul>
      ) : null}
    </aside>
  );
}
