"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CampusGradeLevel, CampusSite } from "rapid-cortex-shared";
import { fetchCampusSites } from "@/lib/campus/campus-dashboard-api";

const GRADE_BADGE: Record<CampusGradeLevel, { label: string; bg: string; color: string }> = {
  hs: { label: "HS", bg: "#1e1230", color: "#8b5cf6" },
  ms: { label: "MS", bg: "#0c1a30", color: "#378add" },
  es: { label: "ES", bg: "#0a1810", color: "#10b981" },
  k8: { label: "K-8", bg: "#0a1810", color: "#10b981" },
  pk12: { label: "PK-12", bg: "#1a1206", color: "#f59e0b" },
};

const C = {
  surface: "#111827",
  surfaceAlert: "#1a1206",
  border: "#1e2a40",
  borderAlert: "#854f0b",
  text: "#e4dff5",
  muted: "#5a4d7a",
  silver: "#7c6fa0",
  amber: "#f59e0b",
  green: "#10b981",
  red: "#ef4444",
};

type AlertStatus = NonNullable<CampusSite["alertStatus"]>;

function StatusDot({ status }: { status: AlertStatus }) {
  const color =
    status === "clear"
      ? C.green
      : status === "active"
        ? C.amber
        : status === "elevated"
          ? C.red
          : "#ff0000";
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
        display: "inline-block",
      }}
    />
  );
}

function statusLabel(status: AlertStatus): string {
  return status === "clear"
    ? "All clear"
    : status === "active"
      ? "Active incident"
      : status === "elevated"
        ? "Elevated — monitor"
        : "LOCKDOWN";
}

export function DistrictSchoolsPanel({
  agencyId,
  linkBase,
}: {
  agencyId: string;
  linkBase: string;
}) {
  const [sites, setSites] = useState<CampusSite[]>([]);
  const router = useRouter();

  useEffect(() => {
    const load = () => {
      void fetchCampusSites(agencyId).then((result) => setSites(result.sites.filter((s) => s.active !== false)));
    };
    load();
    const interval = window.setInterval(load, 30_000);
    return () => window.clearInterval(interval);
  }, [agencyId]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: C.muted,
          }}
        >
          District Schools
        </span>
        <button
          type="button"
          style={{
            fontSize: 11,
            color: "#8b5cf6",
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: 0,
          }}
          onClick={() => router.push(`${linkBase}/sites`)}
        >
          View all
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {sites.map((site) => {
          const grade = site.gradeLevel ?? "es";
          const badge = GRADE_BADGE[grade];
          const alertStatus = site.alertStatus ?? "clear";
          const isAlert = alertStatus !== "clear";
          const incidentCount = site.activeIncidentCount ?? 0;
          const responders = site.respondersOnDuty ?? 0;
          return (
            <button
              type="button"
              key={site.code}
              onClick={() => router.push(`${linkBase}/sites/${encodeURIComponent(site.code)}`)}
              style={{
                background: isAlert ? C.surfaceAlert : C.surface,
                border: `0.5px solid ${isAlert ? C.borderAlert : C.border}`,
                borderRadius: 8,
                padding: "10px 12px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: C.text,
                    lineHeight: 1.3,
                    flex: 1,
                    marginRight: 6,
                  }}
                >
                  {site.name}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: badge.bg,
                    color: badge.color,
                    flexShrink: 0,
                  }}
                >
                  {badge.label}
                </span>
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: C.silver }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: isAlert ? C.amber : C.text,
                    }}
                  >
                    {incidentCount}
                  </span>{" "}
                  incident{incidentCount !== 1 ? "s" : ""}
                </span>
                <span style={{ fontSize: 10, color: C.silver }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                    {responders}
                  </span>{" "}
                  officer{responders !== 1 ? "s" : ""}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 10,
                  color: C.silver,
                }}
              >
                <StatusDot status={alertStatus} />
                {statusLabel(alertStatus)}
              </div>
            </button>
          );
        })}
        {sites.length === 0 ? (
          <div
            style={{
              gridColumn: "1 / -1",
              fontSize: 12,
              color: C.muted,
              textAlign: "center",
              padding: "20px 0",
            }}
          >
            No schools configured for this district yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
