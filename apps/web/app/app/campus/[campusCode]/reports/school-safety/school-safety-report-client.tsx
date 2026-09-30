"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CAMPUS_SITE_SCOPE_ALL,
  getIncidentTypes,
  getK12GroupForType,
  K12_INCIDENT_GROUPS,
  matchesCampusSiteScope,
  normalizeK12IncidentType,
  type SchoolSafetyReportPdfBody,
} from "rapid-cortex-shared";
import { useCampusInstitutionType } from "@/lib/campus/use-campus-institution";
import { useCampusSiteScope } from "@/lib/campus/use-campus-site-scope";
import { fetchCampusIncidents } from "@/lib/campus/campus-incidents-api";
import { fetchCampusStats } from "@/lib/campus/campus-dashboard-api";
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
  const [preparedBy, setPreparedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [snapshot, setSnapshot] = useState<SchoolSafetyReportPdfBody["snapshot"]>();
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
    void Promise.all([
      fetchCampusIncidents(campusCode),
      fetchCampusStats(agencyId).catch(() => null),
    ])
      .then(([rows, stats]) => {
        if (cancelled) return;
        setIncidents(rows);
        if (stats) {
          setSnapshot({
            activeIncidents: stats.activeIncidents,
            respondersOnDuty: stats.respondersOnDuty,
            buildingsMonitored: stats.buildingsMonitored,
          });
        }
        setError(null);
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
  }, [agencyId, campusCode, institutionType]);

  const selectedSite = useMemo(() => {
    if (!scope || scope === CAMPUS_SITE_SCOPE_ALL) return null;
    return sites.find((s) => s.code === scope) ?? null;
  }, [scope, sites]);

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
      const bucket = normalizeK12IncidentType(inc.type);
      map.set(bucket, (map.get(bucket) ?? 0) + 1);
    }
    return map;
  }, [scopedInRange, types]);

  const total = scopedInRange.length;

  const schoolName = selectedSite?.name
    ?? sites.find((s) => s.code === primarySiteCode)?.name
    ?? campusCode;

  if (loading || institutionType !== "k12") {
    return <p style={{ color: C.muted, fontSize: 13 }}>Loading…</p>;
  }

  function buildPdfPayload(): SchoolSafetyReportPdfBody {
    const rows: SchoolSafetyReportPdfBody["rows"] = [];
    for (const group of K12_INCIDENT_GROUPS) {
      const groupTypes = types.filter((t) => getK12GroupForType(t.value) === group.id);
      for (const t of groupTypes) {
        rows.push({
          groupLabel: group.label,
          typeValue: t.value,
          typeLabel: t.label,
          severity: t.severity,
          requiresEscalation: Boolean(t.requiresEscalation),
          count: counts.get(t.value) ?? 0,
        });
      }
    }
    const addressParts = [
      selectedSite?.address,
      [selectedSite?.city, selectedSite?.state].filter(Boolean).join(", "),
    ].filter(Boolean);
    return {
      from,
      to,
      siteCode: selectedSite?.code,
      schoolName,
      schoolShortName: selectedSite?.shortName,
      gradeLevel: selectedSite?.gradeLevel,
      addressLine: addressParts.length ? addressParts.join(" · ") : undefined,
      districtName: campusCode,
      campusCode,
      notes: notes.trim() || undefined,
      preparedBy: preparedBy.trim() || undefined,
      total,
      rows,
      snapshot,
    };
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

  async function exportPdf() {
    setPdfBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/campus/${encodeURIComponent(agencyId)}/reports/school-safety/pdf`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(buildPdfPayload()),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `PDF failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `school-safety-${schoolName.replace(/[^a-zA-Z0-9-_]+/g, "-")}-${from}_${to}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export PDF");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div>
      <h1 style={{ margin: 0, fontSize: 18, color: C.text }}>School Safety Report</h1>
      <p style={{ margin: "6px 0 16px", fontSize: 12, color: C.muted }}>
        Fill school period details, pull live platform counts, and export CSV or PDF. Not a Clery Act
        report.
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
        <button
          type="button"
          onClick={() => void exportPdf()}
          disabled={pdfBusy || fetching}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            background: "#0c1220",
            color: C.text,
            fontWeight: 700,
            cursor: pdfBusy ? "wait" : "pointer",
            opacity: pdfBusy ? 0.6 : 1,
          }}
        >
          {pdfBusy ? "Building PDF…" : "Export PDF"}
        </button>
        <span style={{ fontSize: 12, color: C.silver, marginBottom: 4 }}>
          {fetching ? "Loading…" : `${total} incident${total === 1 ? "" : "s"} in range`}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          marginBottom: 16,
          gridTemplateColumns: "minmax(180px, 1fr) minmax(240px, 2fr)",
        }}
      >
        <label style={{ fontSize: 11, color: C.muted }}>
          Prepared by
          <input
            value={preparedBy}
            onChange={(e) => setPreparedBy(e.target.value)}
            placeholder="Name / title"
            maxLength={120}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 11, color: C.muted }}>
          Notes for this report
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional narrative for the selected school and period…"
            maxLength={4000}
            rows={3}
            style={{ ...inputStyle, resize: "vertical", minHeight: 64 }}
          />
        </label>
      </div>

      {selectedSite ? (
        <p style={{ fontSize: 12, color: C.silver, marginBottom: 12 }}>
          Template header: <strong style={{ color: C.text }}>{selectedSite.name}</strong>
          {selectedSite.gradeLevel ? ` · ${selectedSite.gradeLevel}` : ""}
          {selectedSite.address ? ` · ${selectedSite.address}` : ""}
        </p>
      ) : (
        <p style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
          Select a school to stamp that school’s name and address on the PDF (All schools uses
          district-wide totals).
        </p>
      )}

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
            {K12_INCIDENT_GROUPS.map((group) => {
              const groupTypes = types.filter((t) => getK12GroupForType(t.value) === group.id);
              if (groupTypes.length === 0) return null;
              const groupCount = groupTypes.reduce(
                (sum, t) => sum + (counts.get(t.value) ?? 0),
                0,
              );
              return (
                <Fragment key={group.id}>
                  <tr style={{ borderTop: `1px solid ${C.border}`, background: "#0c1220" }}>
                    <td colSpan={3} style={{ ...td, fontWeight: 700, color: C.silver }}>
                      {group.label}
                    </td>
                    <td
                      style={{
                        ...td,
                        textAlign: "right",
                        fontWeight: 700,
                        color: groupCount > 0 ? C.text : C.muted,
                      }}
                    >
                      {groupCount}
                    </td>
                  </tr>
                  {groupTypes.map((t) => {
                    const count = counts.get(t.value) ?? 0;
                    return (
                      <tr key={t.value} style={{ borderTop: `1px solid ${C.border}`, color: C.text }}>
                        <td style={{ ...td, paddingLeft: 24 }}>{t.label}</td>
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
                </Fragment>
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
  width: "100%",
  padding: "6px 8px",
  borderRadius: 6,
  border: `1px solid ${C.border}`,
  background: "#080710",
  color: C.text,
  boxSizing: "border-box",
};

const th: React.CSSProperties = { padding: "10px 12px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "10px 12px" };
