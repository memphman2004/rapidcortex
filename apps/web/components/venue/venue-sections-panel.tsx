"use client";

import Link from "next/link";
import { fetchVenueSections } from "@/lib/venue/venue-dashboard-api";
import { useEffect, useState } from "react";
import type { VenueSectionSummary } from "rapid-cortex-shared";

export function VenueSectionsPanel({ agencyId, linkBase }: { agencyId: string; linkBase: string }) {
  const [sections, setSections] = useState<VenueSectionSummary[]>([]);

  useEffect(() => {
    void fetchVenueSections(agencyId).then(setSections).catch(() => setSections([]));
  }, [agencyId]);

  return (
    <div style={{ padding: 14 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px" }}>Venue Sections</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
        {sections.map((s) => (
          <Link key={s.sectionId} href={`${linkBase}/sections/${encodeURIComponent(s.sectionId)}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ background: "var(--rc-surface-alt)", border: "1px solid var(--rc-border)", borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 700, color: "var(--rc-amber)" }}>Section {s.sectionName}</div>
              <div style={{ fontSize: 11, color: "var(--rc-text-muted)", marginTop: 4 }}>{s.level} · Gate {s.gate}</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>{s.incidentCount} incidents · cap {s.capacity}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
