"use client";

import { memo } from "react";
import { STADIUM_VIEWBOX } from "@/lib/venue/operational-awareness/demo-stadium-geometry";

/** Static illustrative bowl — not an architectural survey. */
export const StadiumStructure = memo(function StadiumStructure() {
  const { cx, cy } = STADIUM_VIEWBOX;
  return (
    <g aria-hidden>
      <ellipse cx={cx} cy={cy + 8} rx={410} ry={248} fill="#0c0e14" />
      <ellipse cx={cx} cy={cy} rx={398} ry={236} fill="#161b24" stroke="#2a3344" strokeWidth="3" />
      <ellipse cx={cx} cy={cy} rx={318} ry={188} fill="#1c2330" stroke="#323c4e" strokeWidth="1.5" />
      <ellipse cx={cx} cy={cy} rx={228} ry={136} fill="#2a3140" />
      <ellipse cx={cx} cy={cy} rx={118} ry={72} fill="#1f4a32" stroke="#3d7a54" strokeWidth="2" />
      {[-80, -40, 0, 40, 80].map((offset) => (
        <line
          key={offset}
          x1={cx + offset * 0.55}
          y1={cy - 58}
          x2={cx + offset * 0.55}
          y2={cy + 58}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
        />
      ))}
      <ellipse cx={cx} cy={cy} rx={28} ry={16} fill="none" stroke="rgba(255,255,255,0.22)" />
      {NORTH_ROOMS}
      {SOUTH_ROOMS}
      {WEST_ROOMS}
      {EAST_ROOMS}
    </g>
  );
});

const NORTH_ROOMS = (
  <g fill="#1a2030" stroke="#3a4558" strokeWidth="1">
    {Array.from({ length: 8 }).map((_, i) => (
      <rect key={`n-${i}`} x={210 + i * 52} y={42} width={46} height={26} rx="3" />
    ))}
    {Array.from({ length: 6 }).map((_, i) => (
      <rect key={`n2-${i}`} x={262 + i * 52} y={72} width={46} height={22} rx="3" />
    ))}
  </g>
);

const SOUTH_ROOMS = (
  <g fill="#1a2030" stroke="#3a4558" strokeWidth="1">
    {Array.from({ length: 8 }).map((_, i) => (
      <rect key={`s-${i}`} x={210 + i * 52} y={492} width={46} height={26} rx="3" />
    ))}
  </g>
);

const WEST_ROOMS = (
  <g fill="#1a2030" stroke="#3a4558" strokeWidth="1">
    {Array.from({ length: 5 }).map((_, i) => (
      <rect key={`w-${i}`} x={36} y={150 + i * 42} width={58} height={34} rx="3" />
    ))}
  </g>
);

const EAST_ROOMS = (
  <g fill="#1a2030" stroke="#3a4558" strokeWidth="1">
    {Array.from({ length: 5 }).map((_, i) => (
      <rect key={`e-${i}`} x={806} y={150 + i * 42} width={58} height={34} rx="3" />
    ))}
  </g>
);
