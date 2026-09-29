"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCampusInstitutionType } from "@/lib/campus/use-campus-institution";
import { canWritePickupAuth } from "@/lib/campus/campus-authz";

type PickupRecord = {
  studentId: string;
  studentName: string;
  grade?: string;
  siteId?: string;
  authorizedPersons: Array<{
    personId: string;
    name: string;
    relationship: string;
    phone: string;
  }>;
  restrictedPersonIds: string[];
  notes?: string;
};

const C = {
  surface: "#111827",
  border: "#1e2a40",
  text: "#e4dff5",
  muted: "#5a4d7a",
  purple: "#8b5cf6",
  bg: "#080710",
};

export function PickupAuthClient({
  agencyId,
  campusCode,
  userRole,
}: {
  agencyId: string;
  campusCode: string;
  userRole?: string;
}) {
  const { institutionType, loading } = useCampusInstitutionType();
  const router = useRouter();
  const canWrite = canWritePickupAuth(userRole);
  const [records, setRecords] = useState<PickupRecord[]>([]);
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [personName, setPersonName] = useState("");
  const [relationship, setRelationship] = useState("Parent");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && institutionType !== "k12") {
      router.replace(`/app/campus/${campusCode}`);
    }
  }, [loading, institutionType, router, campusCode]);

  useEffect(() => {
    void fetch(`/api/campus/${encodeURIComponent(agencyId)}/pickup-auth`, { cache: "no-store" })
      .then(async (res) => (res.ok ? res.json() : { records: [] }))
      .then((body: { records?: PickupRecord[] }) => setRecords(body.records ?? []))
      .catch(() => setRecords([]));
  }, [agencyId]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/campus/${encodeURIComponent(agencyId)}/pickup-auth`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentId || studentName.toLowerCase().replace(/\s+/g, "-"),
          studentName,
          authorizedPersons: [
            {
              personId: `p-${Date.now()}`,
              name: personName,
              relationship,
              phone,
            },
          ],
          restrictedPersonIds: [],
        }),
      });
      if (res.ok) {
        const body = (await res.json()) as { record: PickupRecord };
        setRecords((prev) => {
          const others = prev.filter((r) => r.studentId !== body.record.studentId);
          return [body.record, ...others];
        });
        setStudentName("");
        setStudentId("");
        setPersonName("");
        setPhone("");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading || institutionType !== "k12") {
    return <p style={{ color: C.muted, fontSize: 13 }}>Loading…</p>;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 18, color: C.text }}>Pickup Authorization</h1>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: C.muted }}>
          Authorized and restricted pickup persons for students in this district.
        </p>
      </div>

      {canWrite ? (
        <form
          onSubmit={onSave}
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: 16,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <input
            required
            placeholder="Student name"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Student ID (optional)"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            style={inputStyle}
          />
          <input
            required
            placeholder="Authorized person name"
            value={personName}
            onChange={(e) => setPersonName(e.target.value)}
            style={inputStyle}
          />
          <input
            required
            placeholder="Relationship"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            style={inputStyle}
          />
          <input
            required
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={saving}
            style={{
              border: "none",
              borderRadius: 8,
              background: C.purple,
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {saving ? "Saving…" : "Save record"}
          </button>
        </form>
      ) : (
        <p style={{ fontSize: 12, color: C.muted }}>View only — Campus Admin can edit pickup records.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {records.length === 0 ? (
          <p style={{ color: C.muted, fontSize: 12 }}>No pickup records yet.</p>
        ) : (
          records.map((r) => (
            <div
              key={r.studentId}
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.studentName}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                ID {r.studentId}
                {r.grade ? ` · Grade ${r.grade}` : ""}
              </div>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: C.text, fontSize: 12 }}>
                {r.authorizedPersons.map((p) => (
                  <li key={p.personId}>
                    {p.name} ({p.relationship}) — {p.phone}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

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
