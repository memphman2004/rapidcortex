"use client";

import type { RcsEscalationLevel } from "rapid-cortex-shared";
import { escalationBg, escalationColor } from "./rcs-ui-utils";

export type RcsEscalationBeaconProps = {
  level: RcsEscalationLevel;
  size?: number;
};

export function RcsEscalationBeacon({ level, size = 10 }: RcsEscalationBeaconProps) {
  if (level === "NONE") return null;
  const color = escalationColor(level);
  const pulse = level === "CRITICAL" || level === "LEVEL_3";

  return (
    <span
      title={`Escalation: ${level}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size + 8,
        height: size + 8,
        borderRadius: "50%",
        background: escalationBg(level),
      }}
    >
      <span
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          boxShadow: pulse ? `0 0 0 0 ${color}` : undefined,
          animation: pulse ? "rcs-beacon-pulse 1.4s ease-out infinite" : undefined,
        }}
      />
      <style>{`
        @keyframes rcs-beacon-pulse {
          0% { box-shadow: 0 0 0 0 ${color}88; }
          70% { box-shadow: 0 0 0 8px ${color}00; }
          100% { box-shadow: 0 0 0 0 ${color}00; }
        }
      `}</style>
    </span>
  );
}
