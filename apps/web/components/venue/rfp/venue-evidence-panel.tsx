"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { VenueEvidenceUploadBody } from "rapid-cortex-shared";
import {
  confirmVenueEvidenceUpload,
  fetchVenueEvidenceCustody,
  fetchVenueEvidenceDownloadUrl,
  fetchVenueEvidenceList,
  requestVenueEvidenceUpload,
  sealVenueEvidenceItem,
  sha256HexFromBlob,
  type VenueCustodyEntry,
  type VenueEvidenceItem,
} from "@/lib/venue/venue-rfp-api";
import { VenueRfpPanelShell } from "./venue-rfp-panel-shell";

export function VenueEvidencePanel({
  venueCode,
  incidentId,
  canMutate,
}: {
  venueCode: string;
  incidentId: string;
  canMutate: boolean;
}) {
  const [items, setItems] = useState<VenueEvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [custody, setCustody] = useState<Record<string, VenueCustodyEntry[]>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchVenueEvidenceList(venueCode, incidentId);
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load evidence");
    } finally {
      setLoading(false);
    }
  }, [incidentId, venueCode]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function loadCustody(evidenceId: string) {
    try {
      const rows = await fetchVenueEvidenceCustody(venueCode, incidentId, evidenceId);
      setCustody((prev) => ({ ...prev, [evidenceId]: rows }));
    } catch {
      setCustody((prev) => ({ ...prev, [evidenceId]: [] }));
    }
  }

  async function uploadFiles(files: FileList | File[]) {
    if (!canMutate) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const sha256 = await sha256HexFromBlob(file);
        const kind: VenueEvidenceUploadBody["kind"] = file.type.startsWith("video/")
          ? "video"
          : file.type.startsWith("image/")
            ? "photo"
            : "document";
        const meta = await requestVenueEvidenceUpload(venueCode, incidentId, {
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          byteSize: file.size,
          sha256,
          kind,
        });
        const put = await fetch(meta.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!put.ok) throw new Error(`Upload failed (${put.status})`);
        await confirmVenueEvidenceUpload(venueCode, incidentId, {
          evidenceId: meta.evidenceId,
          s3Key: meta.s3Key,
          sha256,
        });
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSeal(evidenceId: string) {
    if (!canMutate) return;
    setBusy(true);
    try {
      await sealVenueEvidenceItem(venueCode, incidentId, evidenceId);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Seal failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDownload(evidenceId: string) {
    try {
      const out = await fetchVenueEvidenceDownloadUrl(venueCode, incidentId, evidenceId);
      const url =
        (out as { downloadUrl?: string; url?: string }).downloadUrl ??
        (out as { url?: string }).url;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    }
  }

  return (
    <VenueRfpPanelShell title="Evidence & chain of custody">
      {error ? (
        <p style={{ fontSize: 11, color: "var(--rc-amber)", marginBottom: 8 }}>{error}</p>
      ) : null}
      {canMutate ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length) void uploadFiles(e.dataTransfer.files);
          }}
          style={{
            border: "1px dashed var(--rc-border)",
            borderRadius: 8,
            padding: 16,
            textAlign: "center",
            marginBottom: 12,
            fontSize: 12,
            color: "var(--rc-text-secondary)",
          }}
        >
          <p style={{ margin: "0 0 8px" }}>Drag & drop photos, video, or documents</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              style={btnStyle}
            >
              Choose files
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => cameraInputRef.current?.click()}
              style={btnStyle}
            >
              Camera capture
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => e.target.files && void uploadFiles(e.target.files)}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => e.target.files && void uploadFiles(e.target.files)}
          />
        </div>
      ) : null}
      {loading ? (
        <p style={{ fontSize: 12, color: "var(--rc-text-muted)" }}>Loading evidence…</p>
      ) : items.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--rc-text-muted)" }}>No evidence uploaded yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((item) => (
            <div
              key={item.evidenceId}
              style={{
                border: "1px solid var(--rc-border)",
                borderRadius: 6,
                padding: 10,
                background: "var(--rc-surface-deep)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{item.fileName}</div>
                  <div style={{ fontSize: 10, color: "var(--rc-text-muted)", marginTop: 2 }}>
                    {item.kind} · {item.status}
                    {item.sealed || item.immutableOriginal ? (
                      <span
                        style={{
                          marginLeft: 6,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: "rgba(245,158,11,0.2)",
                          color: "var(--rc-amber)",
                          fontWeight: 700,
                        }}
                      >
                        IMMUTABLE
                      </span>
                    ) : null}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button type="button" style={btnStyle} onClick={() => void onDownload(item.evidenceId)}>
                    Download
                  </button>
                  {canMutate && item.status === "confirmed" && !item.sealed ? (
                    <button type="button" style={btnStyle} disabled={busy} onClick={() => void onSeal(item.evidenceId)}>
                      Seal original
                    </button>
                  ) : null}
                  <button type="button" style={btnStyle} onClick={() => void loadCustody(item.evidenceId)}>
                    CoC timeline
                  </button>
                </div>
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 10,
                  fontFamily: "monospace",
                  color: "var(--rc-text-secondary)",
                  wordBreak: "break-all",
                }}
              >
                SHA-256: {item.sha256}
              </div>
              {(custody[item.evidenceId] ?? []).length > 0 ? (
                <ul style={{ margin: "8px 0 0", paddingLeft: 16, fontSize: 11 }}>
                  {custody[item.evidenceId].map((c) => (
                    <li key={c.custodyId}>
                      {c.transferredAt}: {c.fromCustodianLabel} → {c.toCustodianLabel} — {c.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      )}
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
