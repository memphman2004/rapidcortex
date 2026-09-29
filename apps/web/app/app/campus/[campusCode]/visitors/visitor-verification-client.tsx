"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCampusInstitutionType } from "@/lib/campus/use-campus-institution";

type Clearance = "cleared" | "flagged" | "review_required";

type VisitorRow = {
  visitorId: string;
  firstName: string;
  lastName: string;
  status: Clearance;
  checkedInAt: string;
  siteId?: string | null;
  purposeOfVisit?: string;
};

const C = {
  bg: "#080710",
  surface: "#111827",
  border: "#1e2a40",
  text: "#e4dff5",
  muted: "#5a4d7a",
  purple: "#8b5cf6",
  green: "#10b981",
  red: "#ef4444",
  amber: "#f59e0b",
};

export function VisitorVerificationClient({
  agencyId,
  campusCode,
  agencyName,
}: {
  agencyId: string;
  campusCode: string;
  agencyName: string;
}) {
  const { institutionType, loading: typeLoading } = useCampusInstitutionType();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [idType, setIdType] = useState<"drivers_license" | "state_id" | "passport" | "other">(
    "drivers_license",
  );
  const [purpose, setPurpose] = useState("");
  const [visitingStaff, setVisitingStaff] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    status: Clearance;
    matchCount: number;
    flagSummary?: string;
    screeningError?: boolean;
  } | null>(null);
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);

  const loadVisitors = useCallback(() => {
    void fetch(`/api/campus/${encodeURIComponent(agencyId)}/visitors`, { cache: "no-store" })
      .then(async (res) => (res.ok ? res.json() : { visitors: [] }))
      .then((body: { visitors?: VisitorRow[] }) => setVisitors(body.visitors ?? []))
      .catch(() => setVisitors([]));
  }, [agencyId]);

  useEffect(() => {
    if (!typeLoading && institutionType !== "k12") {
      router.replace(`/app/campus/${campusCode}`);
    }
  }, [typeLoading, institutionType, router, campusCode]);

  useEffect(() => {
    loadVisitors();
    const id = window.setInterval(loadVisitors, 30_000);
    return () => window.clearInterval(id);
  }, [loadVisitors]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/campus/${encodeURIComponent(agencyId)}/visitors/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          idType,
          purposeOfVisit: purpose,
          visitingStaff: visitingStaff || undefined,
          vehiclePlate: vehiclePlate || undefined,
        }),
      });
      const body = (await res.json()) as {
        status?: Clearance;
        matchCount?: number;
        flagSummary?: string;
        screeningError?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setResult({ status: "review_required", matchCount: 0, screeningError: true });
      } else {
        setResult({
          status: body.status ?? "review_required",
          matchCount: body.matchCount ?? 0,
          flagSummary: body.flagSummary,
          screeningError: body.screeningError,
        });
        setFirstName("");
        setLastName("");
        setPurpose("");
        setVisitingStaff("");
        setVehiclePlate("");
        loadVisitors();
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (typeLoading || institutionType !== "k12") {
    return <p style={{ color: C.muted, fontSize: 13 }}>Loading…</p>;
  }

  const statusColor =
    result?.status === "cleared" ? C.green : result?.status === "flagged" ? C.red : C.amber;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <form
        onSubmit={onSubmit}
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 16,
        }}
      >
        <h2 style={{ margin: "0 0 4px", fontSize: 16, color: C.text }}>Visitor check-in</h2>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: C.muted }}>
          {agencyName} — NSOPW screening runs server-side only.
        </p>
        <label style={labelStyle}>First name</label>
        <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />
        <label style={labelStyle}>Last name</label>
        <input required value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />
        <label style={labelStyle}>ID type</label>
        <select
          value={idType}
          onChange={(e) => setIdType(e.target.value as typeof idType)}
          style={inputStyle}
        >
          <option value="drivers_license">Driver license</option>
          <option value="state_id">State ID</option>
          <option value="passport">Passport</option>
          <option value="other">Other</option>
        </select>
        <label style={labelStyle}>Purpose of visit</label>
        <input required value={purpose} onChange={(e) => setPurpose(e.target.value)} style={inputStyle} />
        <label style={labelStyle}>Visiting staff (optional)</label>
        <input value={visitingStaff} onChange={(e) => setVisitingStaff(e.target.value)} style={inputStyle} />
        <label style={labelStyle}>Vehicle plate (optional)</label>
        <input value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} style={inputStyle} />
        <button
          type="submit"
          disabled={submitting}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: "none",
            background: C.purple,
            color: "#fff",
            fontWeight: 700,
            cursor: submitting ? "wait" : "pointer",
          }}
        >
          {submitting ? "Screening…" : "Check in & screen"}
        </button>
        {result ? (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 8,
              border: `1px solid ${statusColor}`,
              background: `${statusColor}22`,
              color: C.text,
              fontSize: 13,
            }}
          >
            {result.status === "cleared" && <strong style={{ color: C.green }}>Cleared for entry</strong>}
            {result.status === "flagged" && (
              <strong style={{ color: C.red }}>
                Flagged — hold visitor, notify administrator
              </strong>
            )}
            {result.status === "review_required" && (
              <strong style={{ color: C.amber }}>
                Screening unavailable — manual review required
              </strong>
            )}
            {result.flagSummary ? (
              <div style={{ marginTop: 6, color: C.muted, fontSize: 12 }}>{result.flagSummary}</div>
            ) : null}
          </div>
        ) : null}
      </form>

      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 16,
        }}
      >
        <h2 style={{ margin: "0 0 12px", fontSize: 16, color: C.text }}>Today&apos;s visitors</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 520, overflowY: "auto" }}>
          {visitors.length === 0 ? (
            <p style={{ color: C.muted, fontSize: 12 }}>No check-ins yet today.</p>
          ) : (
            visitors.map((v) => (
              <div
                key={v.visitorId}
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "8px 10px",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                    {v.firstName} {v.lastName}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    {new Date(v.checkedInAt).toLocaleTimeString()}
                    {v.purposeOfVisit ? ` · ${v.purposeOfVisit}` : ""}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color:
                      v.status === "cleared" ? C.green : v.status === "flagged" ? C.red : C.amber,
                    alignSelf: "center",
                  }}
                >
                  {v.status.replace("_", " ").toUpperCase()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: C.muted,
  marginBottom: 4,
  marginTop: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  borderRadius: 6,
  border: `1px solid ${C.border}`,
  background: C.bg,
  color: C.text,
  fontSize: 13,
};
