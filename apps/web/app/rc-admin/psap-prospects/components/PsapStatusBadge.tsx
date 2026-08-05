"use client";

import type { MouseEvent } from "react";
import {
  PSAP_OUTREACH_STATUS_CONFIG,
  type PsapOutreachStatus,
} from "rapid-cortex-shared";

type Props = {
  status: PsapOutreachStatus;
  size?: "sm" | "md";
  onClick?: (e: MouseEvent) => void;
};

export function PsapStatusBadge({ status, size = "sm", onClick }: Props) {
  const cfg = PSAP_OUTREACH_STATUS_CONFIG[status];
  const sizeClass =
    size === "md" ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[10px]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded font-semibold uppercase tracking-wide ${cfg.bgClass} ${cfg.textClass} ${sizeClass} ${
        onClick ? "cursor-pointer hover:opacity-90" : "cursor-default"
      }`}
      style={{ border: `1px solid ${cfg.color}33` }}
    >
      {cfg.label}
    </button>
  );
}
