"use client";

import { useCallback, useEffect, useState } from "react";

export type VenueThreatLevel = "secure" | "elevated" | "high_alert" | "lockdown";

export const VENUE_THREAT_LEVELS: Record<
  VenueThreatLevel,
  { label: string; bg: string; text: string; border: string }
> = {
  secure: {
    label: "SYSTEM NOMINAL",
    bg: "#0F3D2E",
    text: "#10B981",
    border: "#10B981",
  },
  elevated: {
    label: "ELEVATED",
    bg: "#3D2E0F",
    text: "#F59E0B",
    border: "#F59E0B",
  },
  high_alert: {
    label: "HIGH ALERT",
    bg: "#3D1A0F",
    text: "#EF4444",
    border: "#EF4444",
  },
  lockdown: {
    label: "VENUE LOCKDOWN",
    bg: "#2D0A0A",
    text: "#FF0000",
    border: "#FF0000",
  },
};

export function venueThreatLabel(level: VenueThreatLevel): string {
  return VENUE_THREAT_LEVELS[level].label;
}

function storageKey(agencyId: string): string {
  return `venue-threat-level:${agencyId}`;
}

export function useVenueThreatLevel(agencyId: string) {
  const [level, setLevelState] = useState<VenueThreatLevel>("secure");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(agencyId)) as VenueThreatLevel | null;
      if (raw && raw in VENUE_THREAT_LEVELS) setLevelState(raw);
    } catch {
      /* ignore */
    }
  }, [agencyId]);

  const setLevel = useCallback(
    (next: VenueThreatLevel) => {
      setLevelState(next);
      try {
        window.localStorage.setItem(storageKey(agencyId), next);
      } catch {
        /* ignore */
      }
    },
    [agencyId],
  );

  return { level, setLevel };
}

export function VenueThreatStrip({
  level,
  canChange,
  onChange,
}: {
  level: VenueThreatLevel;
  canChange: boolean;
  onChange: (level: VenueThreatLevel) => void;
}) {
  const cfg = VENUE_THREAT_LEVELS[level];

  return (
    <div
      style={{
        background: cfg.bg,
        borderBottom: `2px solid ${cfg.border}`,
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          color: cfg.text,
          fontWeight: 800,
          fontSize: 12,
          letterSpacing: "0.08em",
        }}
      >
        {cfg.label}
      </span>
      {canChange ? (
        <select
          value={level}
          onChange={(e) => onChange(e.target.value as VenueThreatLevel)}
          style={{
            marginLeft: "auto",
            background: "rgba(0,0,0,0.35)",
            color: cfg.text,
            border: `1px solid ${cfg.border}`,
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {(Object.keys(VENUE_THREAT_LEVELS) as VenueThreatLevel[]).map((key) => (
            <option key={key} value={key}>
              {VENUE_THREAT_LEVELS[key].label}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
