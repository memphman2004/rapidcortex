/**
 * Four-color palette for adjacent map regions (dark Mapbox base).
 * Opacity is baked into the rgba strings — keep fill-opacity at 1 in paint.
 */

export const REGION_COLORS = [
  { fill: "rgba(59, 130, 246, 0.30)", border: "rgba(59, 130, 246, 0.70)" }, // blue
  { fill: "rgba(245, 158, 11, 0.30)", border: "rgba(245, 158, 11, 0.70)" }, // amber
  { fill: "rgba(16, 185, 129, 0.30)", border: "rgba(16, 185, 129, 0.70)" }, // emerald
  { fill: "rgba(139, 92, 246, 0.30)", border: "rgba(139, 92, 246, 0.70)" }, // violet
] as const;

export type RegionColorIndex = 0 | 1 | 2 | 3;
