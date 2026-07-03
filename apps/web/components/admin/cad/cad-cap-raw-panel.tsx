"use client";

/**
 * Admin panel for received CAP 1.2 alerts (raw tab).
 */

import { useCallback, useEffect, useState } from "react";
import { fetchCadCapIncidents, type CadCapRecord, type CapIngestStatus } from "@/lib/api";

const V = {
  bg: "#09080f",
  surface: "#0f0d1a",
  surfaceAlt: "#141220",
  border: "#1e1a30",
  textPrimary: "#e4dff5",
  textSec: "#9b91bb",
  textMuted: "#5a4d7a",
  violet: "#7c3aed",
  green: "#10b981",
  greenBg: "#052e16",
  greenBorder: "#166534",
  amber: "#f59e0b",
  amberBg: "#1c1000",
  amberBorder: "#92400e",
  blue: "#3b82f6",
  blueBg: "#0c1a2e",
  blueBorder: "#1e40af",
  red: "#ef4444",
  redBg: "#1f0808",
  redBorder: "#991b1b",
};

const STATUS_META: Record<
  CapIngestStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  routed: { label: "Routed", color: V.green, bg: V.greenBg, border: V.greenBorder },
  no_agency: { label: "No agency", color: V.amber, bg: V.amberBg, border: V.amberBorder },
  duplicate: { label: "Duplicate", color: V.textMuted, bg: V.surfaceAlt, border: V.border },
  skipped: { label: "Skipped", color: V.textMuted, bg: V.surfaceAlt, border: V.border },
  parse_error: { label: "Parse error", color: V.red, bg: V.redBg, border: V.redBorder },
  received: { label: "Received", color: V.blue, bg: V.blueBg, border: V.blueBorder },
};

const PRIORITY_META = {
  P1: { color: "#fca5a5", bg: "#450a0a", border: "#991b1b" },
  P2: { color: "#fcd34d", bg: "#451a03", border: "#92400e" },
  P3: { color: "#93c5fd", bg: "#0c1a2e", border: "#1e40af" },
  P4: { color: "#a1a1aa", bg: "#18181b", border: "#3f3f46" },
};

const MSG_TYPE_META = {
  Alert: { label: "Alert", color: "#fca5a5" },
  Update: { label: "Update", color: "#fcd34d" },
  Cancel: { label: "Cancel", color: "#a1a1aa" },
  Ack: { label: "Ack", color: "#5a4d7a" },
  Error: { label: "Error", color: V.red },
};

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

function highlightXml(xml: string): string {
  return xml
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /(&lt;\/?)([\w:.-]+)([^&]*?)(\/?&gt;)/g,
      (_, open, tag, attrs, close) =>
        `<span style="color:#7c3aed">${open}</span>` +
        `<span style="color:#93c5fd">${tag}</span>` +
        `<span style="color:#9b91bb">${attrs}</span>` +
        `<span style="color:#7c3aed">${close}</span>`,
    )
    .replace(
      /(&gt;)([^&<]+?)(&lt;)/g,
      (_, gt, content, lt) => `${gt}<span style="color:#86efac">${content}</span>${lt}`,
    );
}

function StatusBadge({ status }: { status: CapIngestStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.received;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: meta.color,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        borderRadius: 4,
        padding: "2px 7px",
      }}
    >
      {meta.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const meta = PRIORITY_META[priority as keyof typeof PRIORITY_META] ?? PRIORITY_META.P4;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: meta.color,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        borderRadius: 4,
        padding: "2px 6px",
      }}
    >
      {priority}
    </span>
  );
}

function MsgTypeBadge({ msgType }: { msgType: string }) {
  const meta = MSG_TYPE_META[msgType as keyof typeof MSG_TYPE_META];
  if (!meta) return null;
  return (
    <span style={{ fontSize: 10, color: meta.color, fontWeight: 700 }}>{meta.label}</span>
  );
}

function CapRow({ record }: { record: CadCapRecord }) {
  const [expanded, setExpanded] = useState(false);
  const [showXml, setShowXml] = useState(false);

  return (
    <div
      style={{
        border: `1px solid ${V.border}`,
        borderLeft: `3px solid ${STATUS_META[record.status]?.border ?? V.border}`,
        borderRadius: 7,
        marginBottom: 6,
        overflow: "hidden",
        background: V.surface,
      }}
    >
      <div
        style={{ padding: "10px 13px", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start" }}
        onClick={() => setExpanded((p) => !p)}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3, flexWrap: "wrap" }}>
            <StatusBadge status={record.status} />
            <PriorityBadge priority={record.priority} />
            <MsgTypeBadge msgType={record.msgType} />
            <span style={{ fontSize: 12, fontWeight: 700, color: V.textPrimary }}>{record.headline}</span>
          </div>
          <div style={{ display: "flex", gap: 10, fontSize: 10, color: V.textMuted, flexWrap: "wrap" }}>
            <span>{record.incidentType}</span>
            {record.areaDesc ? (
              <>
                <span>·</span>
                <span>{record.areaDesc}</span>
              </>
            ) : null}
            {record.fipsCodes.length > 0 ? (
              <>
                <span>·</span>
                <span>
                  FIPS: {record.fipsCodes.slice(0, 3).join(", ")}
                  {record.fipsCodes.length > 3 ? ` +${record.fipsCodes.length - 3}` : ""}
                </span>
              </>
            ) : null}
            {record.rcIncidentId ? (
              <>
                <span>·</span>
                <span style={{ color: V.green }}>RC: {record.rcIncidentId}</span>
              </>
            ) : null}
            <span>·</span>
            <span>{relTime(record.receivedAt)}</span>
          </div>
        </div>
        <span style={{ color: V.textMuted, fontSize: 14, flexShrink: 0 }}>{expanded ? "▾" : "▸"}</span>
      </div>

      {expanded ? (
        <div style={{ borderTop: `1px solid ${V.border}`, padding: "12px 13px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
              marginBottom: 12,
            }}
          >
            {[
              { label: "CAP Identifier", value: record.capIdentifier },
              { label: "Sender", value: record.capSender },
              {
                label: "Sent at",
                value: record.capSentAt ? new Date(record.capSentAt).toLocaleString() : "—",
              },
              { label: "CAP Status", value: record.capStatus },
              { label: "MSG Type", value: record.msgType },
              { label: "Received", value: new Date(record.receivedAt).toLocaleString() },
            ].map((row) => (
              <div key={row.label}>
                <div
                  style={{
                    fontSize: 9,
                    color: V.textMuted,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    marginBottom: 2,
                  }}
                >
                  {row.label}
                </div>
                <div style={{ fontSize: 11, color: V.textSec, fontFamily: "monospace" }}>{row.value}</div>
              </div>
            ))}
          </div>

          {record.fipsCodes.length > 0 ? (
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  fontSize: 9,
                  color: V.textMuted,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                FIPS Codes
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {record.fipsCodes.map((f) => (
                  <span
                    key={f}
                    style={{
                      fontSize: 11,
                      fontFamily: "monospace",
                      color: V.violet,
                      background: "#1a1040",
                      border: `1px solid ${V.border}`,
                      borderRadius: 4,
                      padding: "2px 6px",
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setShowXml((p) => !p)}
            style={{
              padding: "5px 10px",
              background: "transparent",
              border: `1px solid ${V.border}`,
              borderRadius: 5,
              color: V.textMuted,
              fontSize: 11,
              cursor: "pointer",
              marginBottom: showXml ? 8 : 0,
            }}
          >
            {showXml ? "Hide raw XML" : "Show raw XML"}
          </button>

          {showXml && record.rawXml ? (
            <pre
              style={{
                margin: 0,
                padding: "12px 14px",
                background: "#080610",
                border: `1px solid ${V.border}`,
                borderRadius: 6,
                fontSize: 10,
                lineHeight: 1.6,
                overflowX: "auto",
                maxHeight: 400,
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
              dangerouslySetInnerHTML={{ __html: highlightXml(record.rawXml) }}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const STATUSES: Array<CapIngestStatus | "all"> = [
  "all",
  "routed",
  "no_agency",
  "duplicate",
  "skipped",
  "parse_error",
];

export function CadCapRawPanel({ ingestPathAgencyId }: { ingestPathAgencyId: string }) {
  const [records, setRecords] = useState<CadCapRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CapIngestStatus | "all">("all");

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchCadCapIncidents({
        limit: 50,
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      });
      setRecords(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load CAP incidents");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const counts = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            style={{
              padding: "5px 10px",
              background: statusFilter === s ? V.surfaceAlt : "transparent",
              border: `1px solid ${statusFilter === s ? V.border : "transparent"}`,
              borderRadius: 5,
              color: statusFilter === s ? V.textPrimary : V.textMuted,
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            {s === "all"
              ? `All (${records.length})`
              : `${STATUS_META[s]?.label ?? s} (${counts[s] ?? 0})`}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => void load()}
          style={{
            padding: "5px 10px",
            background: "transparent",
            border: `1px solid ${V.border}`,
            borderRadius: 5,
            color: V.textMuted,
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          ↻ Refresh
        </button>
      </div>

      <div
        style={{
          padding: "8px 12px",
          marginBottom: 12,
          background: V.blueBg,
          border: `1px solid ${V.blueBorder}`,
          borderRadius: 6,
          fontSize: 11,
          color: V.textSec,
        }}
      >
        CAP 1.2 alerts received via{" "}
        <code style={{ fontFamily: "monospace", color: V.violet }}>
          POST /api/cad/cap/ingest/{ingestPathAgencyId}
        </code>
        . Routed alerts enter the standard CAD webhook pipeline. Requires a{" "}
        <code style={{ fontFamily: "monospace", color: V.violet }}>cap_inbound</code> integration with{" "}
        <code style={{ fontFamily: "monospace", color: V.violet }}>acceptCapAlerts=true</code>.
      </div>

      {error ? (
        <div
          style={{
            padding: "10px 12px",
            background: V.redBg,
            border: `1px solid ${V.redBorder}`,
            borderRadius: 6,
            fontSize: 12,
            color: "#fca5a5",
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div style={{ padding: 20, textAlign: "center", color: V.textMuted, fontSize: 12 }}>
          Loading CAP incidents…
        </div>
      ) : null}

      {!loading && records.length === 0 ? (
        <div
          style={{
            padding: "24px 14px",
            textAlign: "center",
            border: `1px dashed ${V.border}`,
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 13, color: V.textMuted, marginBottom: 6 }}>No CAP alerts received yet</div>
          <div style={{ fontSize: 11, color: V.textMuted }}>
            Configure a CAP source to POST to the ingest endpoint, or set up an IPAWS feed integration (Phase 4b).
          </div>
        </div>
      ) : null}

      {!loading
        ? records
            .filter((r) => statusFilter === "all" || r.status === statusFilter)
            .map((r, i) => <CapRow key={`${r.sk}-${i}`} record={r} />)
        : null}
    </div>
  );
}
