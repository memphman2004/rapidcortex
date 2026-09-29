"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getIncidentTypes, matchesCampusSiteScope } from "rapid-cortex-shared";
import { useCampusInstitutionType } from "@/lib/campus/use-campus-institution";
import { useCampusSiteScope } from "@/lib/campus/use-campus-site-scope";
import { fetchCampusIncidents } from "@/lib/campus/campus-incidents-api";
import { CampusSiteSwitcher } from "@/components/campus/campus-site-switcher";
import type { CampusIncident } from "@/lib/campus/types";

const C = {
  surface: "#111827",
  border: "#1e2a40",
  text: "#e4dff5",
  muted: "#5a4d7a",
  silver: "#7c6fa0",
  purple: "#8b5cf6",
};

/** Map operational / legacy types onto K-12 catalog buckets when possible. */
const TYPE_ALIASES: Record<string, string> = {
  suspicious_activity: "suspicious",
  property_crime: "theft",
  wellness_check: "welfare_check",
  active_threat: "lockdown_threat",
  security: "trespasser",
  mental_health: "welfare_check",
};

export function SchoolSafetyReportClient({
  agencyId,
  campusCode,
}: {
  agencyId: string;
  campusCode: string;
}) {
  const { institutionType, loading } = useCampusInstitutionType();
  const router = useRouter();
  const { scope, setScope, sites, primarySiteCode } = useCampusSiteScope(agencyId);
  const [from, setFrom] = useState(() =>
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
  );
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [incidents, setIncidents] = useState<CampusIncident[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const types = useMemo(() => getIncidentTypes("k12"), []);

  useEffect(() => {
    if (!loading && institutionType !== "k12") {
      router.replace(`/app/campus/${campusCode}`);
    }
  }, [loading, institutionType, router, campusCode]);

  useEffect(() => {
    if (institutionType !== "k12") return;
    let cancelled = false;
    setFetching(true);
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
        if (!cancelled) setFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campusCode, institutionType]);

  const scopedInRange = useMemo(() => {
    const fromMs = new Date(`${from}T00:00:00`).getTime();
    const toMs = new Date(`${to}T23:59:59`).getTime();
    return incidents.filter((inc) => {
      if (!matchesCampusSiteScope(inc.siteCode, scope, primarySiteCode || campusCode)) {
        return false;
      }
      const t = new Date(inc.createdAt).getTime();
      return Number.isFinite(t) && t >= fromMs && t <= toMs;
    });
  }, [incidents, from, to, scope, primarySiteCode, campusCode]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of types) map.set(t.value, 0);
    for (const inc of scopedInRange) {
      const bucket = TYPE_ALIASES[inc.type] ?? inc.type;
      if (map.has(bucket)) {
        map.set(bucket, (map.get(bucket) ?? 0) + 1);
      } else {
        map.set("other", (map.get("other") ?? 0) + 1);
      }
    }
    return map;
  }, [scopedInRange, types]);

  const total = scopedInRange.length;

  if (loading || institutionType !== "k12") {
    return <p style={{ color: C.muted, fontSize: 13 }}>Loading…</p>;
  }

  function exportCsv() {
    const header = ["incident_type", "label", "severity", "count"];
    const rows = types.map((t) => [
      t.value,
      t.label,
      t.severity,
      String(counts.get(t.value) ?? 0),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `school-safety-${agencyId}-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h1 style={{ margin: 0, fontSize: 18, color: C.text }}>School Safety Report</h1>
      <p style={{ margin: "6px 0 16px", fontSize: 12, color: C.muted }}>
        K-12 incident type breakdown for the selected range. Not a Clery Act report.
      </p>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "end", flexWrap: "wrap" }}>
        <CampusSiteSwitcher sites={sites} value={scope} onChange={setScope} />
        <label style={{ fontSize: 11, color: C.muted }}>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: C.muted }}>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
        </label>
        <button
          type="button"
          onClick={exportCsv}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "none",
            background: C.purple,
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Export CSV
        </button>
        <span style={{ fontSize: 12, color: C.silver, marginBottom: 4 }}>
          {fetching ? "Loading…" : `${total} incident${total === 1 ? "" : "s"} in range`}
        </span>
      </div>
      {error ? <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 12 }}>{error}</p> : null}
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
              <th style={th}>Type</th>
              <th style={th}>Severity</th>
              <th style={th}>Escalation</th>
              <th style={{ ...th, textAlign: "right" }}>Count</th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => {
              const count = counts.get(t.value) ?? 0;
              return (
                <tr key={t.value} style={{ borderTop: `1px solid ${C.border}`, color: C.text }}>
                  <td style={td}>{t.label}</td>
                  <td style={td}>{t.severity}</td>
                  <td style={td}>{t.requiresEscalation ? "Yes" : "—"}</td>
                  <td
                    style={{
                      ...td,
                      textAlign: "right",
                      fontWeight: count > 0 ? 700 : 400,
                      color: count > 0 ? C.text : C.muted,
                    }}
                  >
                    {count}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  marginTop: 4,
  padding: "6px 8px",
  borderRadius: 6,
  border: `1px solid ${C.border}`,
  background: "#080710",
  color: C.text,
};

const th: React.CSSProperties = { padding: "10px 12px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 12px" };
