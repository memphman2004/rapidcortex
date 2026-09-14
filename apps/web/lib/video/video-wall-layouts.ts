import type { VideoWallLayout } from "rapid-cortex-shared";
import { videoWallCellCount } from "rapid-cortex-shared";

export const VIDEO_WALL_LAYOUT_OPTIONS: Array<{ id: VideoWallLayout; label: string; cells: number }> = [
  { id: "1x1", label: "1×1", cells: 1 },
  { id: "2x2", label: "2×2", cells: 4 },
  { id: "3x3", label: "3×3", cells: 9 },
  { id: "4x4", label: "4×4", cells: 16 },
];

export function gridTemplateColumns(layout: VideoWallLayout): string {
  if (layout === "1x1") return "1fr";
  if (layout === "2x2") return "1fr 1fr";
  if (layout === "3x3") return "1fr 1fr 1fr";
  if (layout === "4x4") return "1fr 1fr 1fr 1fr";
  return "repeat(auto-fill, minmax(240px, 1fr))";
}

export function emptyPositions(layout: VideoWallLayout): number[] {
  return Array.from({ length: videoWallCellCount(layout) }, (_, i) => i);
}
