"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { VenueOnDutyStaff } from "rapid-cortex-shared";
import type { VenueIncident } from "@/app/venue/[venueCode]/_lib/venue-types";
import { fetchVenueOnDuty } from "@/lib/venue/venue-dashboard-api";
import { fetchVenueIncidents } from "@/lib/venue/venue-incidents-api";
import { formatVenueTimeAgo, mapVenueIncidentType } from "./use-venue-ops-data";

const V = {
  surface: "#141220",
  border: "#1e1a30",
  amber: "#f59e0b",
  text: "#e4dff5",
  muted: "#5a4d7a",
};

export function VenueStaffDetailClient({
  agencyId,
  userId,
  linkBase,
  venueCode,
}: {
  agencyId: string;
  userId: string;
  linkBase: string;
  venueCode: string;
}) {
  const [member, setMember] = useState<VenueOnDutyStaff | null>(null);
  const [incidents, setIncidents] = useState<VenueIncident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [onDuty, allIncidents] = await Promise.all([
          fetchVenueOnDuty(agencyId),
          fetchVenueIncidents(venueCode).catch(() => []),
        ]);
        if (cancelled) return;
        const found = onDuty.find((s) => s.userId === userId) ?? null;
        setMember(found);
        const name = found?.displayName?.trim();
        setIncidents(
          allIncidents.filter(
            (inc) =>
              inc.assignedTo === name ||
              inc.assignedTo === userId ||
              (name && inc.assignedTo?.includes(name)),
          ),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agencyId, userId, venueCode]);

  const activeIncident = useMemo(
    () =>
      incidents.find((inc) => ["open", "assigned", "responding"].includes(inc.status)) ?? null,
    [incidents],
  );

  const shiftHistory = useMemo(
    () =>
      [...incidents]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 10),
    [incidents],
  );

  return (
    <div style={{ padding: 14 }}>
      <Link href={`${linkBase}/staff`} style={{ color: "#7c6fa0", fontSize: 12, textDecoration: "none" }}>
        ← Staff roster
      </Link>

      {loading ? (
        <p style={{ fontSize: 12, color: V.muted, marginTop: 12 }}>Loading staff profile…</p>
      ) : !member ? (
        <p style={{ fontSize: 12, color: V.muted, marginTop: 12 }}>
          Staff member not found on current duty roster.
        </p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "12px 0 16px" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#1a1528",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                color: V.amber,
                fontSize: 16,
              }}
            >
              {member.initials}
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: V.text }}>{member.displayName}</h2>
              <p style={{ fontSize: 12, color: V.muted, margin: "4px 0 0" }}>
                {member.role} · Zone {member.zone}
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Card title="DUTY STATUS">
              <Stat label="Status" value={member.status.replace(/_/g, " ").toUpperCase()} />
              <Stat label="Zone assignment" value={member.zone || "—"} />
              <Stat label="User ID" value={member.userId} />
            </Card>

            <Card title="ACTIVE INCIDENT">
              {activeIncident ? (
                <Link
                  href={`${linkBase}/incidents/${encodeURIComponent(activeIncident.id)}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: V.text }}>
                    {mapVenueIncidentType(activeIncident.type)} · Section {activeIncident.zoneCode}
                  </div>
                  <div style={{ fontSize: 11, color: V.muted, marginTop: 4 }}>
                    {activeIncident.description.slice(0, 100)}
                  </div>
                  <div style={{ fontSize: 10, color: V.amber, marginTop: 6 }}>
                    {formatVenueTimeAgo(activeIncident.createdAt)}
                  </div>
                </Link>
              ) : (
                <p style={{ fontSize: 11, color: V.muted, margin: 0 }}>Not assigned to an active incident.</p>
              )}
            </Card>

            <Card title="SHIFT HISTORY (INCIDENT ASSIGNMENTS)">
              {shiftHistory.length === 0 ? (
                <p style={{ fontSize: 11, color: V.muted, margin: 0 }}>No recorded assignments this shift.</p>
              ) : (
                shiftHistory.map((inc) => (
                  <div key={inc.id} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: V.text }}>
                      {mapVenueIncidentType(inc.type)} · {inc.status}
                    </div>
                    <div style={{ fontSize: 10, color: V.muted }}>
                      Section {inc.zoneCode} · {formatVenueTimeAgo(inc.updatedAt)}
                    </div>
                  </div>
                ))
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 8 }}>
      <div
        style={{
          padding: "10px 12px",
          borderBottom: `1px solid ${V.border}`,
          fontSize: 11,
          fontWeight: 700,
          color: "#7c6fa0",
        }}
      >
        {title}
      </div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: V.muted }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: V.text }}>{value}</div>
    </div>
  );
}
