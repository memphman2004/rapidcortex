/**
 * RCS intelligence UI helpers — color/elapsed utilities layered on `rcs-colors.ts`.
 */

import type { RcsAudioStatus, RcsEscalationLevel } from "rapid-cortex-shared";
import { rcsEscalationColor } from "@/lib/rcs/rcs-colors";

const ESCALATION_BG: Record<RcsEscalationLevel, string> = {
  NONE: "rgba(34, 197, 94, 0.12)",
  LEVEL_1: "rgba(234, 179, 8, 0.14)",
  LEVEL_2: "rgba(249, 115, 22, 0.14)",
  LEVEL_3: "rgba(239, 68, 68, 0.16)",
  CRITICAL: "rgba(220, 38, 38, 0.22)",
};

const AUDIO_STATUS_COLOR: Record<RcsAudioStatus, string> = {
  SILENT: "#f97316",
  LISTENING: "#38bdf8",
  ALERT: "#ef4444",
  CONFIRMED_SAFE: "#22c55e",
  CONFIRMED_DANGER: "#dc2626",
};

const ESCALATION_RANK: Record<RcsEscalationLevel, number> = {
  CRITICAL: 0,
  LEVEL_3: 1,
  LEVEL_2: 2,
  LEVEL_1: 3,
  NONE: 4,
};

export function escalationColor(level: RcsEscalationLevel): string {
  return rcsEscalationColor(level);
}

export function escalationBg(level: RcsEscalationLevel): string {
  return ESCALATION_BG[level] ?? ESCALATION_BG.NONE;
}

export function audioStatusColor(status: RcsAudioStatus): string {
  return AUDIO_STATUS_COLOR[status] ?? AUDIO_STATUS_COLOR.LISTENING;
}

/** Format elapsed duration from an ISO timestamp or total seconds. */
export function formatElapsed(startedAtOrSeconds: string | number): string {
  let totalSeconds: number;
  if (typeof startedAtOrSeconds === "number") {
    totalSeconds = Math.max(0, Math.floor(startedAtOrSeconds));
  } else {
    const ms = Date.now() - new Date(startedAtOrSeconds).getTime();
    if (!Number.isFinite(ms) || ms < 0) return "—";
    totalSeconds = Math.floor(ms / 1000);
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function escalationSortRank(level: RcsEscalationLevel): number {
  return ESCALATION_RANK[level] ?? 99;
}
