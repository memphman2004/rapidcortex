"use client";

import type { TransitAlertLevel } from "rapid-cortex-shared";

export const TRANSIT_ALERT_LEVELS: Record<
  TransitAlertLevel,
  { label: string; bg: string; text: string; border: string }
> = {
  nominal: { label: "SYSTEM NOMINAL", bg: "#0F3D2E", text: "#10B981", border: "#10B981" },
  elevated: { label: "ELEVATED", bg: "#3D2E0F", text: "#F59E0B", border: "#F59E0B" },
  high_alert: { label: "HIGH ALERT", bg: "#3D1510", text: "#F97316", border: "#F97316" },
  emergency_stop: { label: "EMERGENCY STOP", bg: "#3D0F14", text: "#EF4444", border: "#EF4444" },
};

export function transitAlertLabel(level: TransitAlertLevel): string {
  return TRANSIT_ALERT_LEVELS[level]?.label ?? level;
}

export function TransitAlertStrip(props: {
  level: TransitAlertLevel;
  canChange: boolean;
  disabled?: boolean;
  onChange: (level: TransitAlertLevel) => void;
}) {
  const ui = TRANSIT_ALERT_LEVELS[props.level];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 16px",
        background: ui.bg,
        borderBottom: `1px solid ${ui.border}`,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: ui.text }}>
        {ui.label}
      </span>
      {props.canChange ? (
        <select
          value={props.level}
          disabled={props.disabled}
          onChange={(e) => props.onChange(e.target.value as TransitAlertLevel)}
          style={{
            marginLeft: "auto",
            background: "#0c0b14",
            color: ui.text,
            border: `1px solid ${ui.border}`,
            borderRadius: 6,
            fontSize: 11,
            padding: "4px 8px",
          }}
        >
          {(Object.keys(TRANSIT_ALERT_LEVELS) as TransitAlertLevel[]).map((key) => (
            <option key={key} value={key}>
              {TRANSIT_ALERT_LEVELS[key].label}
            </option>
          ))}
        </select>
      ) : (
        <span style={{ marginLeft: "auto", fontSize: 10, color: ui.text }}>VIEW ONLY</span>
      )}
    </div>
  );
}
