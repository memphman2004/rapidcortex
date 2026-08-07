/**
 * Response Continuity System (RCS) color tokens — aligned with
 * `rapid-cortex-shared` call states and escalation levels.
 */

import type { RcsCallState, RcsEscalationLevel } from "rapid-cortex-shared";

export type RcsColorToken = {
  bg: string;
  border: string;
  text: string;
  dot: string;
  label: string;
};

export const RCS_SURFACE = {
  cardBg: "var(--rc-surface)",
  heading: "var(--rc-text-primary)",
  bodyText: "var(--rc-text-secondary)",
  subtleText: "var(--rc-text-muted)",
  border: "var(--rc-border)",
} as const;

export const RCS_STATE_COLORS: Record<RcsCallState, RcsColorToken> = {
  MONITORING: {
    bg: "rgba(14, 165, 233, 0.08)",
    border: "rgba(56, 189, 248, 0.35)",
    text: "#7dd3fc",
    dot: "#38bdf8",
    label: "Monitoring",
  },
  UNIT_DISPATCHED: {
    bg: "rgba(56, 189, 248, 0.10)",
    border: "rgba(56, 189, 248, 0.4)",
    text: "#7dd3fc",
    dot: "#38bdf8",
    label: "Unit Dispatched",
  },
  UNIT_EN_ROUTE: {
    bg: "rgba(234, 179, 8, 0.10)",
    border: "rgba(250, 204, 21, 0.4)",
    text: "#fde047",
    dot: "#facc15",
    label: "En Route",
  },
  UNIT_ARRIVED: {
    bg: "rgba(34, 197, 94, 0.10)",
    border: "rgba(74, 222, 128, 0.4)",
    text: "#86efac",
    dot: "#4ade80",
    label: "Unit Arrived",
  },
  AUDIO_ALERT: {
    bg: "rgba(249, 115, 22, 0.12)",
    border: "rgba(251, 146, 60, 0.45)",
    text: "#fdba74",
    dot: "#fb923c",
    label: "Audio Alert",
  },
  ESCALATED: {
    bg: "rgba(239, 68, 68, 0.10)",
    border: "rgba(248, 113, 113, 0.45)",
    text: "#fca5a5",
    dot: "#f87171",
    label: "Escalated",
  },
  SUPERVISOR_ACKNOWLEDGED: {
    bg: "rgba(124, 58, 237, 0.12)",
    border: "rgba(167, 139, 250, 0.45)",
    text: "#c4b5fd",
    dot: "#a78bfa",
    label: "Supervisor Ack",
  },
  CLOSED: {
    bg: "rgba(100, 116, 139, 0.12)",
    border: "rgba(148, 163, 184, 0.35)",
    text: "#94a3b8",
    dot: "#64748b",
    label: "Closed",
  },
  OVERRIDE_CLOSED: {
    bg: "rgba(124, 58, 237, 0.10)",
    border: "rgba(167, 139, 250, 0.4)",
    text: "#c4b5fd",
    dot: "#a78bfa",
    label: "Override Closed",
  },
};

export const RCS_ESCALATION_COLORS: Record<RcsEscalationLevel, string> = {
  NONE: "#22c55e",
  LEVEL_1: "#eab308",
  LEVEL_2: "#f97316",
  LEVEL_3: "#ef4444",
  CRITICAL: "#dc2626",
};

export function rcsStateToken(state: RcsCallState): RcsColorToken {
  return RCS_STATE_COLORS[state] ?? RCS_STATE_COLORS.MONITORING;
}

export function rcsEscalationColor(level: RcsEscalationLevel): string {
  return RCS_ESCALATION_COLORS[level] ?? RCS_ESCALATION_COLORS.NONE;
}

export type RcsPulseState = "none" | "warn" | "critical";

export function rcsPulseFromEscalation(level: RcsEscalationLevel): RcsPulseState {
  if (level === "CRITICAL" || level === "LEVEL_3") return "critical";
  if (level === "LEVEL_1" || level === "LEVEL_2") return "warn";
  return "none";
}
