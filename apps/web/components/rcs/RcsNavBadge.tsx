"use client";

import type { CSSProperties } from "react";
import type { RcsCall } from "@/lib/rcs/rcs-api";
import { rcsPulseFromEscalation, type RcsPulseState } from "@/lib/rcs/rcs-colors";

export type RcsNavBadgeProps = {
  count: number;
  pulse?: RcsPulseState;
};

const PULSE_CSS = `
@keyframes rcsBadgePulseCritical {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
@keyframes rcsBadgePulseEmergency {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.15; transform: scale(1.25); }
}
`;

export function rcsNavBadgeStateFromCalls(calls: RcsCall[]): { count: number; pulse: RcsPulseState } {
  let pulse: RcsPulseState = "none";
  let count = 0;
  for (const call of calls) {
    if (call.state === "CLOSED" || call.state === "OVERRIDE_CLOSED") continue;
    count += 1;
    const p = rcsPulseFromEscalation(call.escalationLevel);
    if (p === "critical") pulse = "critical";
    else if (p === "warn" && pulse !== "critical") pulse = "warn";
  }
  return { count, pulse };
}

export function RcsNavBadge({ count, pulse = "none" }: RcsNavBadgeProps) {
  if (count <= 0 && pulse === "none") return null;

  return (
    <span
      style={{
        marginLeft: "auto",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        borderRadius: 999,
        padding: count > 0 ? "1px 6px" : 2,
        fontSize: 10,
        fontWeight: 700,
        lineHeight: "14px",
        color: pulse === "critical" ? "#fca5a5" : pulse === "warn" ? "#fde047" : "#7dd3fc",
        background:
          pulse === "critical"
            ? "rgba(239, 68, 68, 0.16)"
            : pulse === "warn"
              ? "rgba(234, 179, 8, 0.14)"
              : "rgba(56, 189, 248, 0.14)",
        animation:
          pulse === "critical"
            ? "rcsBadgePulseEmergency 0.7s ease-in-out infinite"
            : pulse === "warn"
              ? "rcsBadgePulseCritical 1.2s ease-in-out infinite"
              : "none",
      }}
    >
      <style>{PULSE_CSS}</style>
      {pulse !== "none" ? (
        <span
          style={
            {
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: pulse === "critical" ? "#ef4444" : "#eab308",
            } as CSSProperties
          }
        />
      ) : null}
      {count > 0 ? count : null}
    </span>
  );
}
