"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { matchesCampusSiteScope, type CampusSite } from "rapid-cortex-shared";
import { fetchCampusSites } from "@/lib/campus/campus-dashboard-api";
import { fetchCampusIncidents } from "@/lib/campus/campus-incidents-api";
import type { CampusIncident } from "@/lib/campus/types";
import { formatClockTime } from "@/lib/clock-format";
import { useClockPreference } from "@/components/providers/clock-preference-provider";

const C = {
  surface: "#111827",
  border: "#1e2a40",
  text: "#e4dff5",
  muted: "#5a4d7a",
  silver: "#7c6fa0",
  purple: "#8b5cf6",
  amber: "#f59e0b",
  green: "#10b981",
};

export function SchoolSiteDetailClient({
  agencyId,
  campusCode,
  siteCode,
}: {
  agencyId: string;
  campusCode: string;
  siteCode: string;
}) {
  const { hour12 } = useClockPreference();
  const [site, setSite] = useState<CampusSite | null>(null);
  const [incidents, setIncidents] = useState<CampusIncident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      fetchCampusSites(agencyId),
      fetchCampusIncidents(campusCode),
    ])
      .then(([sitesResult, rows]) => {
        if (cancelled) return;
        const match =
          sitesResult.sites.find((s) => s.code.toUpperCase() === siteCode) ?? null;
        setSite(match);
        setIncidents(
          rows.filter((r) => matchesCampusSiteScope(r.siteCode, siteCode, siteCode)),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setSite(null);
          setIncidents([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agencyId, campusCode, siteCode]);

  const open = useMemo(
    () =>
      incidents.filter(
        (i) => i.status === "open" || i.status === "assigned" || i.status === "responding",
      ),
    [incidents],
  );

  if (loading) {
    return <p style={{ color: C.muted, fontSize: 13 }}>Loading school…</p>;
  }

  if (!site) {
    return (
      <p style={{ color: C.muted, fontSize: 13 }}>
        School {siteCode} was not found for this district.
      </p>
    );
  }

  const alert = site.alertStatus ?? "clear";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 20, color: C.text }}>{site.name}</h1>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 4,
            background: "#1e1230",
            color: C.purple,
          }}
        >
          {site.shortName || site.code}
        </span>
        {site.gradeLevel ? (
          <span style={{ fontSize: 11, color: C.silver }}>
            {site.gradeLevel.toUpperCase()}
          </span>
        ) : null}
      </div>
      <p style={{ margin: "8px 0 16px", fontSize: 12, color: C.muted }}>
        {[site.city, site.state].filter(Boolean).join(", ") || "District school"}
        {" · "}
        <span style={{ color: alert === "clear" ? C.green : C.amber }}>
          {alert === "clear" ? "All clear" : alert.replace(/_/g, " ")}
        </span>
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
          marginBottom: 18,
        }}
      >
        {[
          { label: "Active incidents", value: open.length },
          { label: "Responders on duty", value: site.respondersOnDuty ?? 0 },
          { label: "Total in log", value: incidents.length },
        ].map((kpi) => (
          <div
            key={kpi.label}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: "12px 14px",
            }}
          >
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: "0.06em" }}>
              {kpi.label.toUpperCase()}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.text, marginTop: 4 }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <Link
          href={`/app/campus/${campusCode}/incidents`}
          style={{ fontSize: 12, color: C.purple, fontWeight: 600 }}
        >
          Open live incidents →
        </Link>
        <Link
          href={`/app/campus/${campusCode}/visitors`}
          style={{ fontSize: 12, color: C.purple, fontWeight: 600 }}
        >
          Visitor verification →
        </Link>
        <Link
          href={`/app/campus/${campusCode}/reports/incidents`}
          style={{ fontSize: 12, color: C.purple, fontWeight: 600 }}
        >
          Incident log →
        </Link>
      </div>

      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "10px 12px",
            borderBottom: `1px solid ${C.border}`,
            fontSize: 11,
            fontWeight: 700,
            color: C.muted,
            letterSpacing: "0.06em",
          }}
        >
          RECENT INCIDENTS
        </div>
        {open.length === 0 && incidents.length === 0 ? (
          <p style={{ padding: 14, fontSize: 12, color: C.muted, margin: 0 }}>
            No incidents recorded for this school yet.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {[...open, ...incidents.filter((i) => !open.includes(i))]
              .slice(0, 12)
              .map((inc) => (
                <li
                  key={inc.id}
                  style={{
                    padding: "10px 12px",
                    borderTop: `1px solid ${C.border}`,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    fontSize: 12,
                    color: C.text,
                  }}
                >
                  <span>
                    {inc.type.replace(/_/g, " ")}
                    {inc.buildingLabel ? ` · ${inc.buildingLabel}` : ""}
                  </span>
                  <span style={{ color: C.silver, flexShrink: 0 }}>
                    {formatClockTime(inc.createdAt, hour12)} · {inc.status}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
