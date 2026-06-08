"use client";

import { features, isVerticalEnabled } from "@/lib/features";
import {
  VERTICAL_CONFIG,
  type Vertical,
  normalizeVertical,
  deriveVerticalFromAgencyId,
  resolveAgencyVerticalFromTenant,
  formatAgencyType,
} from "@/lib/vertical";

export type { Vertical };
export {
  VERTICAL_CONFIG,
  normalizeVertical,
  deriveVerticalFromAgencyId,
  resolveAgencyVerticalFromTenant,
  formatAgencyType,
};

export function VerticalBadge({
  vertical,
  size = "sm",
}: {
  vertical: Vertical;
  size?: "xs" | "sm";
}) {
  if (!features.verticalBadge) return null;
  if (!isVerticalEnabled(vertical)) return null;
  const cfg = VERTICAL_CONFIG[vertical];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-semibold uppercase tracking-wide ${
        size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"
      }`}
      style={{ color: cfg.color, borderColor: cfg.color, backgroundColor: cfg.bg }}
      title={cfg.label}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  );
}
