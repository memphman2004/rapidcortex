"use client";

import { Expand, Box, Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import { MapIconButton } from "../MapIconButton";

export function ExteriorMapControls({
  onZoomIn,
  onZoomOut,
  onFit,
  onToggle3d,
  is3d,
  onExpand,
  onPopOut,
  expandLabel = "Expand area map",
  showExpand = true,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onToggle3d?: () => void;
  is3d?: boolean;
  onExpand: () => void;
  onPopOut: () => void;
  expandLabel?: string;
  showExpand?: boolean;
}) {
  return (
    <div className="absolute right-3 top-3 z-20 flex flex-col gap-1">
      <MapIconButton label="Zoom in" onClick={onZoomIn}>
        <Plus size={14} />
      </MapIconButton>
      <MapIconButton label="Zoom out" onClick={onZoomOut}>
        <Minus size={14} />
      </MapIconButton>
      <MapIconButton label="Reset / fit venue" onClick={onFit}>
        <RotateCcw size={14} />
      </MapIconButton>
      {onToggle3d ? (
        <MapIconButton label={is3d ? "Switch to 2D" : "Switch to 3D isometric"} onClick={onToggle3d} pressed={is3d}>
          <Box size={14} />
        </MapIconButton>
      ) : null}
      {showExpand ? (
        <MapIconButton label={expandLabel} onClick={onExpand}>
          <Expand size={14} />
        </MapIconButton>
      ) : null}
      <MapIconButton label="Open in window" onClick={onPopOut}>
        <Maximize2 size={14} />
      </MapIconButton>
    </div>
  );
}
