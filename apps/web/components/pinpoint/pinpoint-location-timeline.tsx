"use client";

import { useState } from "react";
import { calculateDistanceMeters } from "rapid-cortex-shared/geo/distance";
import type { PinpointPing } from "rapid-cortex-shared/pinpoint-surge";

export function PinpointLocationTimeline({
  pings,
  onLocationSelect,
}: {
  pings: PinpointPing[];
  onLocationSelect?: (ping: PinpointPing) => void;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const reversed = [...pings].reverse();

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-3">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Location history ({pings.length})
        </h4>
        <ul className="space-y-2">
          {reversed.map((ping, index) => {
            const previous = index < reversed.length - 1 ? reversed[index + 1] : null;
            const distanceM =
              previous != null
                ? Math.round(
                    calculateDistanceMeters(previous.lat, previous.lng, ping.lat, ping.lng),
                  )
                : null;
            const secondsApart =
              previous != null
                ? Math.round(
                    (new Date(ping.capturedAt).getTime() - new Date(previous.capturedAt).getTime()) /
                      1000,
                  )
                : null;
            const key = `${ping.capturedAt}-${ping.lat}-${ping.lng}`;
            const expanded = expandedKey === key;

            return (
              <li
                key={key}
                className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/50"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800/40"
                  onClick={() => {
                    setExpandedKey(expanded ? null : key);
                    onLocationSelect?.(ping);
                  }}
                >
                  <span className="font-mono text-slate-300">
                    {new Date(ping.capturedAt).toLocaleTimeString()}
                  </span>
                  <span className="text-slate-500">
                    {distanceM != null && secondsApart != null
                      ? `${distanceM} m / ${secondsApart}s`
                      : "First fix"}
                  </span>
                </button>
                {expanded ? (
                  <div className="border-t border-slate-800 px-3 py-2 font-mono text-[11px] text-slate-400">
                    <div>lat {ping.lat.toFixed(6)}</div>
                    <div>lng {ping.lng.toFixed(6)}</div>
                    {ping.accuracyM != null ? <div>±{Math.round(ping.accuracyM)} m</div> : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
