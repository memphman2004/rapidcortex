"use client";

import type { VideoFragment } from "rapid-cortex-shared";

export function DVRFragmentBar({
  fragments,
  windowStart,
  windowEnd,
}: {
  fragments: VideoFragment[];
  windowStart: number;
  windowEnd: number;
}) {
  const span = Math.max(1, windowEnd - windowStart);
  return (
    <div className="relative h-6 overflow-hidden rounded" style={{ background: "#1a1528" }} aria-label="Recorded fragments">
      {fragments.map((frag) => {
        const start = Date.parse(frag.startTime);
        const end = Date.parse(frag.endTime);
        if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
        const left = ((start - windowStart) / span) * 100;
        const width = Math.max(((end - start) / span) * 100, 0.4);
        return (
          <div
            key={frag.fragmentNumber}
            className="absolute top-0 h-full"
            style={{ left: `${left}%`, width: `${width}%`, background: "#7c3aed" }}
          />
        );
      })}
    </div>
  );
}
