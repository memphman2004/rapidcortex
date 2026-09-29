"use client";

import { useCampusInstitutionType } from "@/lib/campus/use-campus-institution";

export function CampusK12Banner({ agencyId }: { agencyId: string }) {
  const { institutionType, loading } = useCampusInstitutionType();
  if (loading || institutionType !== "k12" || !agencyId) return null;
  return (
    <div
      style={{
        marginTop: 12,
        border: "1px solid rgba(245,158,11,0.35)",
        background: "rgba(245,158,11,0.08)",
        borderRadius: 8,
        padding: "8px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#f59e0b",
          letterSpacing: "0.1em",
        }}
      >
        K-12
      </span>
      <span style={{ fontSize: 12, color: "#7c6fa0", fontWeight: 500 }}>
        District console — schools view (not a 911 dispatch system)
      </span>
    </div>
  );
}
