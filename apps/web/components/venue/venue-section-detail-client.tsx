"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { VenueSectionSummary } from "rapid-cortex-shared";
import type { VenueIncident } from "@/app/venue/[venueCode]/_lib/venue-types";
import { fetchVenueIncidents } from "@/lib/venue/venue-incidents-api";
import { fetchVenueSections, fetchVenueOnDuty } from "@/lib/venue/venue-dashboard-api";
import { fetchVenueSectionCameras } from "@/lib/venue/venue-camera-api";
import {
  formatVenueTimeAgo,
  mapVenueIncidentStatus,
  mapVenueIncidentType,
} from "./use-venue-ops-data";


export function VenueSectionDetailClient({
  agencyId,
  sectionId,
  linkBase,
  venueCode,
}: {
  agencyId: string;
  sectionId: string;
  linkBase: string;
  venueCode: string;
}) {
  const [section, setSection] = useState<VenueSectionSummary | null>(null);
  const [incidents, setIncidents] = useState<VenueIncident[]>([]);
  const [cameras, setCameras] = useState<
    Awaited<ReturnType<typeof fetchVenueSectionCameras>>
  >([]);
  const [staff, setStaff] = useState<Awaited<ReturnType<typeof fetchVenueOnDuty>>>([]);
  const [loading, setLoading] = useState(true);

  const decodedSection = decodeURIComponent(sectionId);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [sections, allIncidents, sectionCameras, onDuty] = await Promise.all([
          fetchVenueSections(agencyId),
          fetchVenueIncidents(venueCode).catch(() => []),
          fetchVenueSectionCameras(agencyId, decodedSection, 20).catch(() => []),
          fetchVenueOnDuty(agencyId).catch(() => []),
        ]);
        if (cancelled) return;
        const matchedSection =
          sections.find(
            (s) =>
              s.sectionId === decodedSection ||
              s.sectionName === decodedSection ||
              s.sectionId === sectionId,
          ) ?? null;
        setSection(matchedSection);
        const sectionIncidents = allIncidents.filter(
          (inc) =>
            inc.zoneCode === decodedSection ||
            inc.zoneLabel === decodedSection ||
            inc.zoneCode === sectionId,
        );
        setIncidents(sectionIncidents);
        setCameras(sectionCameras);
        setStaff(
          onDuty.filter(
            (m) =>
              m.zone === decodedSection ||
              m.zone === matchedSection?.sectionName ||
              m.zone.replace(/\D/g, "") === decodedSection.replace(/\D/g, ""),
          ),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agencyId, decodedSection, sectionId, venueCode]);

  const activeIncidents = useMemo(
    () =>
      incidents.filter((inc) => ["open", "assigned", "responding"].includes(inc.status)),
    [incidents],
  );

  const recentHistory = useMemo(
    () =>
      [...incidents]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 12),
    [incidents],
  );

  const title = section?.sectionName ?? decodedSection;

  return (
    <div style={{ padding: 14 }}>
      <Link href={`${linkBase}/sections`} style={{ color: "var(--rc-text-secondary)", fontSize: 12, textDecoration: "none" }}>
        ← Sections
      </Link>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "12px 0 4px", color: "var(--rc-text-primary)" }}>
        Section {title}
      </h2>
      {section ? (
        <p style={{ fontSize: 12, color: "var(--rc-text-secondary)", margin: "0 0 16px" }}>
          {section.level} · Gate {section.gate} · Cap {section.capacity} · Status {section.status}
        </p>
      ) : (
        <p style={{ fontSize: 12, color: "var(--rc-text-secondary)", margin: "0 0 16px" }}>Zone coverage for {decodedSection}</p>
      )}

      {loading ? (
        <p style={{ fontSize: 12, color: "var(--rc-text-secondary)" }}>Loading section…</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <SectionBlock title="ACTIVE INCIDENTS" count={activeIncidents.length}>
            {activeIncidents.length === 0 ? (
              <EmptyRow text="No active incidents in this section." />
            ) : (
              activeIncidents.map((inc) => (
                <Link
                  key={inc.id}
                  href={`${linkBase}/incidents/${encodeURIComponent(inc.id)}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <Row
                    primary={`${mapVenueIncidentType(inc.type)} · ${mapVenueIncidentStatus(inc.status)}`}
                    secondary={inc.description.slice(0, 80)}
                    meta={formatVenueTimeAgo(inc.createdAt)}
                  />
                </Link>
              ))
            )}
          </SectionBlock>

          <SectionBlock title="SECTION CAMERAS" count={cameras.length}>
            {cameras.length === 0 ? (
              <EmptyRow text="No cameras registered for this section." />
            ) : (
              cameras.map((cam) => (
                <Row
                  key={cam.cameraId}
                  primary={cam.displayName}
                  secondary={`${cam.vendor} · ${cam.kvsChannelName}`}
                  meta={cam.ptzCapable ? "PTZ" : "Fixed"}
                />
              ))
            )}
          </SectionBlock>

          <SectionBlock title="RESPONDERS IN SECTION" count={staff.length}>
            {staff.length === 0 ? (
              <EmptyRow text="No on-duty staff assigned to this zone." />
            ) : (
              staff.map((member) => (
                <Link
                  key={member.userId}
                  href={`${linkBase}/staff/${member.userId}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <Row
                    primary={member.displayName}
                    secondary={`${member.role} · ${member.status.replace(/_/g, " ")}`}
                    meta={member.zone}
                  />
                </Link>
              ))
            )}
          </SectionBlock>

          <SectionBlock title="RECENT INCIDENT HISTORY" count={recentHistory.length}>
            {recentHistory.length === 0 ? (
              <EmptyRow text="No prior incidents recorded for this section." />
            ) : (
              recentHistory.map((inc) => (
                <Link
                  key={inc.id}
                  href={`${linkBase}/incidents/${encodeURIComponent(inc.id)}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <Row
                    primary={`${mapVenueIncidentType(inc.type)} · ${inc.status}`}
                    secondary={inc.assignedTo ? `Assigned: ${inc.assignedTo}` : "Unassigned"}
                    meta={formatVenueTimeAgo(inc.createdAt)}
                  />
                </Link>
              ))
            )}
          </SectionBlock>
        </div>
      )}
    </div>
  );
}

function SectionBlock({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ background: "var(--rc-surface)", border: `1px solid var(--rc-border)`, borderRadius: 8 }}>
      <div
        style={{
          padding: "10px 12px",
          borderBottom: `1px solid var(--rc-border)`,
          fontSize: 11,
          fontWeight: 700,
          color: "var(--rc-text-secondary)",
          letterSpacing: "0.05em",
        }}
      >
        {title} ({count})
      </div>
      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

function Row({ primary, secondary, meta }: { primary: string; secondary: string; meta: string }) {
  return (
    <div
      style={{
        background: "var(--rc-surface)",
        border: `1px solid var(--rc-border)`,
        borderRadius: 6,
        padding: "8px 10px",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--rc-text-primary)" }}>{primary}</div>
      <div style={{ fontSize: 11, color: "var(--rc-text-secondary)", marginTop: 2 }}>{secondary}</div>
      <div style={{ fontSize: 10, color: "var(--rc-amber)", marginTop: 4 }}>{meta}</div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p style={{ fontSize: 11, color: "var(--rc-text-secondary)", margin: "4px 6px" }}>{text}</p>;
}
