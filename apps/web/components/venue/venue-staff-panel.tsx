"use client";

import Link from "next/link";
import { fetchVenueOnDuty } from "@/lib/venue/venue-dashboard-api";
import { useEffect, useState } from "react";
import type { VenueOnDutyStaff } from "rapid-cortex-shared";

export function VenueStaffPanel({ agencyId, linkBase }: { agencyId: string; linkBase: string }) {
  const [staff, setStaff] = useState<VenueOnDutyStaff[]>([]);

  useEffect(() => {
    void fetchVenueOnDuty(agencyId).then(setStaff).catch(() => setStaff([]));
  }, [agencyId]);

  return (
    <div style={{ padding: 14 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px" }}>Staff On Duty</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {staff.map((member) => (
          <Link key={member.userId} href={`${linkBase}/staff/${member.userId}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ background: "#141220", border: "1px solid #1e1a30", borderRadius: 8, padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1a1528", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#f59e0b" }}>
                {member.initials}
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{member.displayName}</div>
                <div style={{ fontSize: 11, color: "#5a4d7a" }}>{member.role} · {member.zone} · {member.status.replace(/_/g, " ")}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
