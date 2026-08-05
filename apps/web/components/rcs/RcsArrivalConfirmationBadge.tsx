"use client";

import type { RcsUnit } from "rapid-cortex-shared";
import { MapPin } from "lucide-react";

export type RcsArrivalConfirmationBadgeProps = {
  units: Pick<RcsUnit, "unitId" | "callSign" | "onScene" | "distanceMeters">[];
  compact?: boolean;
};

export function RcsArrivalConfirmationBadge({ units, compact = false }: RcsArrivalConfirmationBadgeProps) {
  const onScene = units.filter((u) => u.onScene);
  if (onScene.length === 0) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: compact ? 10 : 11,
          color: "#94a3b8",
        }}
      >
        <MapPin size={compact ? 11 : 12} />
        Awaiting arrival
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>
      {onScene.map((u) => (
        <span
          key={u.unitId}
          title={
            u.distanceMeters != null
              ? `${u.callSign ?? u.unitId} · ${Math.round(u.distanceMeters)}m`
              : u.callSign ?? u.unitId
          }
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            borderRadius: 999,
            padding: compact ? "2px 6px" : "3px 8px",
            fontSize: compact ? 9 : 10,
            fontWeight: 700,
            letterSpacing: 0.2,
            textTransform: "uppercase",
            color: "#86efac",
            background: "rgba(34, 197, 94, 0.14)",
            border: "1px solid rgba(74, 222, 128, 0.4)",
          }}
        >
          <MapPin size={10} />
          {u.callSign ?? u.unitId} on scene
        </span>
      ))}
    </span>
  );
}
