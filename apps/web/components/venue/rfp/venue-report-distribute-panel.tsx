"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  distributeVenueIncidentReport,
  fetchVenueIncidentReports,
  generateVenueIncidentReport,
  type VenueReportItem,
} from "@/lib/venue/venue-rfp-api";
import { VenueRfpPanelShell } from "./venue-rfp-panel-shell";

export function VenueReportDistributePanel({
  venueCode,
  incidentId,
  canMutate,
}: {
  venueCode: string;
  incidentId: string;
  canMutate: boolean;
}) {
  const [reports, setReports] = useState<VenueReportItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [ttlHours, setTtlHours] = useState(72);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientLabel, setRecipientLabel] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      const rows = await fetchVenueIncidentReports(venueCode, incidentId);
      setReports(rows);
      if (!selectedId && rows[0]?.reportId) setSelectedId(rows[0].reportId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
    }
  }

  useEffect(() => {
    void reload();
  }, [incidentId, venueCode]);

  async function onGenerate() {
    if (!canMutate) return;
    setError(null);
    try {
      const out = await generateVenueIncidentReport(venueCode, incidentId, ttlHours);
      setShareUrl(out.reportUrl);
      setMessage(`Report generated · expires ${out.expiresAt}`);
      setSelectedId(out.reportId);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
    }
  }

  async function onDistribute() {
    if (!canMutate || !selectedId) return;
    setError(null);
    try {
      const out = await distributeVenueIncidentReport(venueCode, incidentId, selectedId, {
        recipientEmail: recipientEmail.trim() || undefined,
        recipientLabel: recipientLabel.trim() || undefined,
        ttlHours,
        includeAttachments: true,
      });
      setShareUrl(out.reportUrl);
      setMessage(`Secure link ready · expires ${out.expiresAt}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Distribute failed");
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage("Link copied to clipboard");
    } catch {
      setMessage("Copy failed — select link manually");
    }
  }

  return (
    <VenueRfpPanelShell title="Reports & secure share">
      {error ? <p style={{ fontSize: 11, color: "var(--rc-amber)" }}>{error}</p> : null}
      {message ? <p style={{ fontSize: 11, color: "var(--rc-text-secondary)" }}>{message}</p> : null}
      {canMutate ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, fontSize: 11 }}>
          <label>
            TTL (hours){" "}
            <input
              type="number"
              min={1}
              max={168}
              value={ttlHours}
              onChange={(e) => setTtlHours(Number(e.target.value))}
              style={inputStyle}
            />
          </label>
          <button type="button" style={btnStyle} onClick={() => void onGenerate()}>
            Generate PDF
          </button>
        </div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 11, marginBottom: 12 }}>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={inputStyle}
          disabled={reports.length === 0}
        >
          {reports.length === 0 ? <option value="">No reports yet</option> : null}
          {reports.map((r) => (
            <option key={r.reportId} value={r.reportId}>
              {r.reportId} · {r.createdAt}
            </option>
          ))}
        </select>
        <input
          placeholder="Recipient email (optional)"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="Recipient label"
          value={recipientLabel}
          onChange={(e) => setRecipientLabel(e.target.value)}
          style={inputStyle}
        />
        {canMutate ? (
          <button type="button" style={btnStyle} disabled={!selectedId} onClick={() => void onDistribute()}>
            Distribute secure link
          </button>
        ) : null}
      </div>
      {shareUrl ? (
        <div style={{ fontSize: 10, wordBreak: "break-all", marginBottom: 8 }}>{shareUrl}</div>
      ) : null}
      {shareUrl ? (
        <button type="button" style={btnStyle} onClick={() => void copyLink()}>
          Copy link
        </button>
      ) : null}
    </VenueRfpPanelShell>
  );
}

const btnStyle: CSSProperties = {
  fontSize: 11,
  padding: "4px 10px",
  borderRadius: 6,
  border: "1px solid var(--rc-border)",
  background: "var(--rc-surface)",
  color: "var(--rc-text-primary)",
  cursor: "pointer",
};

const inputStyle: CSSProperties = {
  fontSize: 11,
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid var(--rc-border)",
  background: "var(--rc-surface-deep)",
  color: "var(--rc-text-primary)",
};
