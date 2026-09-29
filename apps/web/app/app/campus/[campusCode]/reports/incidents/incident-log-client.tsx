"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getIncidentTypes, matchesCampusSiteScope } from "rapid-cortex-shared";
import { useCampusInstitutionType } from "@/lib/campus/use-campus-institution";
import { useCampusSiteScope } from "@/lib/campus/use-campus-site-scope";
import { fetchCampusIncidents } from "@/lib/campus/campus-incidents-api";
import { CampusSiteSwitcher } from "@/components/campus/campus-site-switcher";
import type { CampusIncident, CampusIncidentStatus } from "@/lib/campus/types";
import { formatClockTime } from "@/lib/clock-format";
import { useClockPreference } from "@/components/providers/clock-preference-provider";

const C = {
  surface: "#111827",
  border: "#1e2a40",
  text: "#e4dff5",
  muted: "#5a4d7a",
  silver: "#7c6fa0",
  purple: "#8b5cf6",
  green: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
};

type StatusFilter = "all" | CampusIncidentStatus;

function typeLabel(type: string): string {
  const catalog = getIncidentTypes("k12");
  const hit = catalog.find((t) => t.value === type);
  if (hit) return hit.label;
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusColor(status: CampusIncidentStatus): string {
  if (status === "open" || status === "assigned" || status === "responding") return C.amber;
  if (status === "escalated") return C.red;
  return C.green;
}

export function IncidentLogClient({
  campusCode,
  agencyId,
}: {
  campusCode: string;
  agencyId: string;
}) {
  const { institutionType, loading: typeLoading } = useCampusInstitutionType();
  const router = useRouter();
  const { hour12 } = useClockPreference();
  const { scope, setScope, sites, primarySiteCode } = useCampusSiteScope(agencyId);
  const [incidents, setIncidents] = useState<CampusIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!typeLoading && institutionType !== "k12") {
      router.replace(`/app/campus/${campusCode}`);
    }
  }, [typeLoading, institutionType, router, campusCode]);

  useEffect(() => {
    if (institutionType !== "k12") return;
    let cancelled = false;
    setLoading(true);
    void fetchCampusIncidents(campusCode)
      .then((rows) => {
        if (!cancelled) {
          setIncidents(rows);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load incidents");
          setIncidents([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campusCode, institutionType]);

  const filtered = useMemo(() => {
    let rows = incidents.filter((r) =>
      matchesCampusSiteScope(r.siteCode, scope, primarySiteCode || campusCode),
    );
    if (statusFilter !== "all") rows = rows.filter((r) => r.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => {
        const school = sites.find((s) => s.code === (r.siteCode ?? "").toUpperCase());
        const hay = [
          r.id,
          r.type,
          r.description,
          r.buildingLabel,
          r.zoneLabel,
          r.siteCode,
          school?.shortName,
          school?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return [...rows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [incidents, scope, primarySiteCode, campusCode, statusFilter, search, sites]);

  if (typeLoading || institutionType !== "k12") {
    return <p style={{ color: C.muted, fontSize: 13 }}>Loading…</p>;
  }

  return (
    <div>
      <h1 style={{ margin: 0, fontSize: 18, color: C.text }}>Incident Log</h1>
      <p style={{ margin: "6px 0 16px", fontSize: 12, color: C.silver }}>
        District-wide incident history for K-12 (replaces the higher-ed Daily Crime Log).
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 14,
          alignItems: "center",
        }}
      >
        <CampusSiteSwitcher sites={sites} value={scope} onChange={setScope} />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          style={selectStyle}
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="assigned">Assigned</option>
          <option value="responding">Responding</option>
          <option value="resolved">Resolved</option>
          <option value="escalated">Escalated</option>
          <option value="referred">Referred</option>
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search type, school, building…"
          style={{ ...selectStyle, minWidth: 220 }}
        />
        <span style={{ fontSize: 11, color: C.muted }}>
          {filtered.length} record{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {error ? (
        <p style={{ color: C.red, fontSize: 12, marginBottom: 12 }}>{error}</p>
      ) : null}

      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ color: C.muted, textAlign: "left" }}>
              <th style={th}>When</th>
              <th style={th}>School</th>
              <th style={th}>Type</th>
              <th style={th}>Location</th>
              <th style={th}>Status</th>
              <th style={th}>ID</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ ...td, color: C.muted }}>
                  Loading incidents…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ ...td, color: C.muted }}>
                  No incidents match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((inc) => {
                const school = sites.find(
                  (s) => s.code === (inc.siteCode ?? "").toUpperCase(),
                );
                const tag = school?.shortName || school?.code || inc.siteCode || "—";
                return (
                  <tr key={inc.id} style={{ borderTop: `1px solid ${C.border}`, color: C.text }}>
                    <td style={td}>{formatClockTime(inc.createdAt, hour12)}</td>
                    <td style={td}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "#1e1230",
                          color: C.purple,
                        }}
                      >
                        {tag}
                      </span>
                    </td>
                    <td style={td}>{typeLabel(inc.type)}</td>
                    <td style={{ ...td, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {[inc.buildingLabel, inc.roomCode].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td style={td}>
                      <span style={{ color: statusColor(inc.status), fontWeight: 600 }}>
                        {inc.status.replace(/_/g, " ").toUpperCase()}
                      </span>
                    </td>
                    <td style={{ ...td, fontFamily: "ui-monospace, monospace", fontSize: 11, color: C.silver }}>
                      {inc.id}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 6,
  border: `1px solid ${C.border}`,
  background: "#080710",
  color: C.text,
  fontSize: 12,
};

const th: React.CSSProperties = { padding: "10px 12px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 12px" };
