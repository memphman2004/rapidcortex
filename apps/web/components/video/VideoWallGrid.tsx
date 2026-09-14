"use client";

import type { VideoTileAssignment, VideoWallLayout } from "rapid-cortex-shared";
import { videoWallCellCount } from "rapid-cortex-shared";
import type { CameraApiVertical } from "@/lib/venue/venue-camera-api";
import { gridTemplateColumns } from "@/lib/video/video-wall-layouts";
import { VideoTile } from "./VideoTile";

export function VideoWallGrid({
  agencyId,
  apiVertical,
  layout,
  tiles,
  selectedPosition,
  onSelect,
  onFullscreen,
  onAssign,
}: {
  agencyId: string;
  apiVertical: CameraApiVertical;
  layout: VideoWallLayout;
  tiles: VideoTileAssignment[];
  selectedPosition: number | null;
  onSelect: (position: number) => void;
  onFullscreen: (position: number) => void;
  onAssign: (position: number, cameraId: string) => void;
}) {
  const cells = videoWallCellCount(layout);
  const byPos = new Map(tiles.map((t) => [t.position, t]));
  return (
    <div
      className="grid h-full min-h-0 flex-1 gap-px p-px"
      style={{
        gridTemplateColumns: gridTemplateColumns(layout),
        background: "#0a0812",
      }}
    >
      {Array.from({ length: cells }, (_, position) => (
        <VideoTile
          key={position}
          agencyId={agencyId}
          apiVertical={apiVertical}
          tile={byPos.get(position) ?? null}
          selected={selectedPosition === position}
          onSelect={() => onSelect(position)}
          onFullscreen={() => onFullscreen(position)}
          onDropCamera={(cameraId) => onAssign(position, cameraId)}
        />
      ))}
    </div>
  );
}
