"use client";

import type { SlaLevelStatus } from "rapid-cortex-shared";

function worstStatus(a: SlaLevelStatus, b: SlaLevelStatus | "pending"): SlaLevelStatus | "pending" {
  if (b === "pending") return a;
  const rank = (s: SlaLevelStatus) => (s === "breached" ? 2 : s === "warning" ? 1 : 0);
  return rank(a) >= rank(b) ? a : b;
}

export function slaTone(
  answer: SlaLevelStatus,
  dispatch: SlaLevelStatus | "pending",
): "ok" | "warning" | "breach" {
  const combined = worstStatus(answer, dispatch);
  if (combined === "breached") return "breach";
  if (combined === "warning") return "warning";
  return "ok";
}

export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}
