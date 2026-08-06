"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { VenueOnDutyStaff } from "rapid-cortex-shared";
import type { VenueIncident } from "@/app/venue/[venueCode]/_lib/venue-types";
import { fetchVenueOnDuty } from "@/lib/venue/venue-dashboard-api";
import { fetchVenueIncidents } from "@/lib/venue/venue-incidents-api";
import { formatVenueTimeAgo, mapVenueIncidentType } from "./use-venue-ops-data";


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
      <Link href={`${linkBase}/staff`} style={{ color: "var(--rc-text-secondary)", fontSize: 12, textDecoration: "none" }}>
        ← Staff roster
      </Link>

      {loading ? (
        <p style={{ fontSize: 12, color: "var(--rc-text-secondary)", marginTop: 12 }}>Loading staff profile…</p>
      ) : !member ? (
        <p style={{ fontSize: 12, color: "var(--rc-text-secondary)", marginTop: 12 }}>
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
                background: "var(--rc-surface-hover)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                color: "var(--rc-amber)",
                fontSize: 16,
              }}
            >
              {member.initials}
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--rc-text-primary)" }}>{member.displayName}</h2>
              <p style={{ fontSize: 12, color: "var(--rc-text-secondary)", margin: "4px 0 0" }}>
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
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--rc-text-primary)" }}>
                    {mapVenueIncidentType(activeIncident.type)} · Section {activeIncident.zoneCode}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--rc-text-secondary)", marginTop: 4 }}>
                    {activeIncident.description.slice(0, 100)}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--rc-amber)", marginTop: 6 }}>
                    {formatVenueTimeAgo(activeIncident.createdAt)}
                  </div>
                </Link>
              ) : (
                <p style={{ fontSize: 11, color: "var(--rc-text-secondary)", margin: 0 }}>Not assigned to an active incident.</p>
              )}
            </Card>

            <Card title="SHIFT HISTORY (INCIDENT ASSIGNMENTS)">
              {shiftHistory.length === 0 ? (
                <p style={{ fontSize: 11, color: "var(--rc-text-secondary)", margin: 0 }}>No recorded assignments this shift.</p>
              ) : (
                shiftHistory.map((inc) => (
                  <div key={inc.id} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: "var(--rc-text-primary)" }}>
                      {mapVenueIncidentType(inc.type)} · {inc.status}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--rc-text-secondary)" }}>
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
    <div style={{ background: "var(--rc-surface)", border: `1px solid var(--rc-border)`, borderRadius: 8 }}>
      <div
        style={{
          padding: "10px 12px",
          borderBottom: `1px solid var(--rc-border)`,
          fontSize: 11,
          fontWeight: 700,
          color: "var(--rc-text-secondary)",
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
      <div style={{ fontSize: 10, color: "var(--rc-text-secondary)" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--rc-text-primary)" }}>{value}</div>
    </div>
  );
}
