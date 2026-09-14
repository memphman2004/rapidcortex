"use client";

import { Plus } from "lucide-react";
import type { VideoTileAssignment } from "rapid-cortex-shared";
import { KVSWebRTCPlayer } from "@/components/venue/KVSWebRTCPlayer";
import type { CameraApiVertical } from "@/lib/venue/venue-camera-api";
import { VideoTileOverlay } from "./VideoTileOverlay";

export function VideoTile({
  agencyId,
  apiVertical,
  tile,
  selected,
  onSelect,
  onFullscreen,
  onDropCamera,
}: {
  agencyId: string;
  apiVertical: CameraApiVertical;
  tile: VideoTileAssignment | null;
  selected: boolean;
  onSelect: () => void;
  onFullscreen: () => void;
  onDropCamera: (cameraId: string) => void;
}) {
  return (
    <div
      className="relative min-h-[140px] overflow-hidden"
      style={{
        background: "#0d0b1a",
        border: selected ? "2px solid #6d28d9" : "1px solid #1a1528",
      }}
      onClick={onSelect}
      onDoubleClick={onFullscreen}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const cameraId = e.dataTransfer.getData("text/camera-id");
        if (cameraId) onDropCamera(cameraId);
      }}
    >
      {tile ? (
        <>
          <KVSWebRTCPlayer
            agencyId={agencyId}
            kvsChannelName={tile.kvsChannelName}
            displayName={tile.displayName}
            apiVertical={apiVertical}
            variant="fill"
          />
          <VideoTileOverlay tile={tile} onFullscreen={onFullscreen} />
        </>
      ) : (
        <button
          type="button"
          className="flex h-full min-h-[140px] w-full items-center justify-center"
          style={{ border: "1px dashed #2d2442", color: "#6b5f87" }}
          onClick={onSelect}
          aria-label="Assign camera"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
