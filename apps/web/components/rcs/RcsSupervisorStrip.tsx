"use client";

import type { ReactNode } from "react";
import { Radio, ShieldAlert, Siren } from "lucide-react";
import { RCS_SURFACE } from "@/lib/rcs/rcs-colors";
import type { RcsCall } from "@/lib/rcs/rcs-api";

export type RcsSupervisorStripProps = {
  calls: RcsCall[];
};

function StatPill({
  icon,
  label,
  value,
  color,
  bg,
  border,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  color: string;
  bg: string;
  border: string;
}) {
  return (
    <div
      style={{
        flex: "1 1 140px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 10,
        border: `1px solid ${border}`,
        background: bg,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: 8,
          background: "rgba(255,255,255,0.05)",
          color,
        }}
      >
        {icon}
      </span>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: RCS_SURFACE.heading, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 10, color: RCS_SURFACE.subtleText, textTransform: "uppercase", letterSpacing: 0.3 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

export function RcsSupervisorStrip({ calls }: RcsSupervisorStripProps) {
  const open = calls.filter((c) => c.state !== "CLOSED" && c.state !== "OVERRIDE_CLOSED");
  const active = open.length;
  const atRisk = open.filter(
    (c) => c.state === "AUDIO_ALERT" || c.escalationLevel === "LEVEL_1" || c.escalationLevel === "LEVEL_2",
  ).length;
  const escalated = open.filter(
    (c) => c.state === "ESCALATED" || c.escalationLevel === "LEVEL_3" || c.escalationLevel === "CRITICAL",
  ).length;
  const arrived = open.filter((c) => c.state === "UNIT_ARRIVED").length;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      <StatPill
        icon={<Radio size={14} />}
        label="Active"
        value={active}
        color="#7dd3fc"
        bg="rgba(14, 165, 233, 0.08)"
        border="rgba(56, 189, 248, 0.3)"
      />
      <StatPill
        icon={<ShieldAlert size={14} />}
        label="At risk"
        value={atRisk}
        color="#fde047"
        bg="rgba(234, 179, 8, 0.1)"
        border="rgba(250, 204, 21, 0.35)"
      />
      <StatPill
        icon={<Siren size={14} />}
        label="Escalated"
        value={escalated}
        color="#fca5a5"
        bg="rgba(239, 68, 68, 0.1)"
        border="rgba(248, 113, 113, 0.4)"
      />
      <StatPill
        icon={<Radio size={14} />}
        label="On scene"
        value={arrived}
        color="#86efac"
        bg="rgba(34, 197, 94, 0.1)"
        border="rgba(74, 222, 128, 0.35)"
      />
    </div>
  );
}
