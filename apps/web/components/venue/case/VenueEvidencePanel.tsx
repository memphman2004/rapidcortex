"use client";

/**
 * VenueEvidencePanel — RFP 2396IP, Build Items 1 + 4
 *
 * Displays evidence items for a venue incident with:
 * - File upload (SHA-256 computed client-side before upload)
 * - Confirmed/pending/corrupted status badges
 * - Download links (presigned URL)
 * - Chain-of-custody modal per item
 * - PDF report request button
 * - Secure share button
 */

import { useState, useRef, useTransition } from "react";
import {
  requestEvidenceUploadUrl,
  confirmEvidenceUpload,
  listEvidence,
  getEvidenceDownloadUrl,
  listCustodyChain,
  requestIncidentPdfReport,
  createSecureShare,
} from "@/lib/venue/venue-case-api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EvidenceItem {
  evidenceId: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  kind: string;
  label?: string;
  status: "pending_upload" | "confirmed" | "corrupted";
  uploadedByLabel: string;
  confirmedAt?: string;
  createdAt: string;
}

interface CustodyEntry {
  custodyId: string;
  fromCustodianLabel: string;
  toCustodianLabel: string;
  reason: string;
  transferredAt: string;
}

interface VenueEvidencePanelProps {
  incidentId: string;
  initialEvidence?: EvidenceItem[];
}

// ─── SHA-256 client-side helper ───────────────────────────────────────────────

async function sha256File(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<EvidenceItem["status"], string> = {
  pending_upload: "text-yellow-400",
  confirmed: "text-green-400",
  corrupted: "text-red-400",
};

const STATUS_LABELS: Record<EvidenceItem["status"], string> = {
  pending_upload: "Pending",
  confirmed: "✓ Confirmed",
  corrupted: "⚠ Corrupted",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VenueEvidencePanel({
  incidentId,
  initialEvidence = [],
}: VenueEvidencePanelProps) {
  const [evidence, setEvidence] = useState<EvidenceItem[]>(initialEvidence);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Custody modal
  const [custodyEvidenceId, setCustodyEvidenceId] = useState<string | null>(null);
  const [custodyChain, setCustodyChain] = useState<CustodyEntry[]>([]);
  const [loadingCustody, setLoadingCustody] = useState(false);

  // Share modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareNote, setShareNote] = useState("");
  const [shareResult, setShareResult] = useState<string | null>(null);

  // PDF report
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // ─── Upload handler ─────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploading(true);
    setUploadProgress("Computing SHA-256…");

    try {
      const sha256 = await sha256File(file);
      setUploadProgress("Requesting upload URL…");

      const { evidenceId, uploadUrl, s3Key } = await requestEvidenceUploadUrl(incidentId, {
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        byteSize: file.size,
        sha256,
        kind: file.type.startsWith("image/")
          ? "photo"
          : file.type.startsWith("video/")
            ? "video"
            : file.type === "application/pdf"
              ? "document"
              : "other",
      });

      setUploadProgress("Uploading…");

      // PUT directly to S3 via presigned URL
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!putRes.ok) throw new Error(`S3 upload failed: ${putRes.status}`);

      setUploadProgress("Confirming SHA-256…");

      const confirmed = await confirmEvidenceUpload(incidentId, { evidenceId, s3Key, sha256 });

      // Refresh evidence list
      const updated = await listEvidence(incidentId);
      setEvidence(updated.evidence as EvidenceItem[]);
      setUploadProgress(null);

      if (confirmed.status === "corrupted") {
        setUploadError("Upload completed but SHA-256 mismatch detected. File marked corrupted.");
      }
    } catch (err) {
      setUploadError((err as Error).message);
      setUploadProgress(null);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // ─── Download ───────────────────────────────────────────────────────────────

  async function handleDownload(evidenceId: string) {
    try {
      const { url } = await getEvidenceDownloadUrl(incidentId, evidenceId);
      window.open(url, "_blank", "noopener");
    } catch {
      alert("Could not get download URL");
    }
  }

  // ─── Custody modal ──────────────────────────────────────────────────────────

  async function openCustodyModal(evidenceId: string) {
    setCustodyEvidenceId(evidenceId);
    setLoadingCustody(true);
    try {
      const { custody } = await listCustodyChain(incidentId, evidenceId);
      setCustodyChain(custody as CustodyEntry[]);
    } catch {
      setCustodyChain([]);
    } finally {
      setLoadingCustody(false);
    }
  }

  // ─── PDF report ─────────────────────────────────────────────────────────────

  function handleReportRequest() {
    setReportStatus("Generating…");
    startTransition(async () => {
      try {
        const result = await requestIncidentPdfReport(incidentId);
        if (result.status === "ready") {
          window.open(result.downloadUrl, "_blank", "noopener");
          setReportStatus("PDF ready — opened in new tab");
        } else {
          setReportStatus("PDF generation queued (check back in a moment)");
        }
      } catch {
        setReportStatus("Failed to generate PDF");
      }
    });
  }

  // ─── Secure share ───────────────────────────────────────────────────────────

  async function handleShare() {
    setShareResult(null);
    try {
      const result = await createSecureShare(incidentId, {
        recipientEmail: shareEmail.trim() || undefined,
        note: shareNote.trim() || undefined,
        ttlHours: 72,
        includeAttachments: true,
      });
      setShareResult(result.shareUrl);
    } catch (err) {
      setShareResult(`Error: ${(err as Error).message}`);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-lg border border-white/10 bg-slate-800/60 p-4 space-y-4">
      {/* Header + actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80">
          Evidence ({evidence.length})
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handleReportRequest}
            disabled={isPending}
            title="Generate PDF report"
            className="rounded px-2.5 py-1 text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50"
          >
            📄 PDF Report
          </button>
          <button
            onClick={() => { setShowShareModal(true); setShareResult(null); }}
            className="rounded px-2.5 py-1 text-xs bg-slate-700 text-slate-300 hover:bg-slate-600"
          >
            🔗 Share
          </button>
          <label className="cursor-pointer rounded px-2.5 py-1 text-xs bg-orange-600 text-white hover:bg-orange-500">
            + Add File
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="image/*,video/*,application/pdf,.doc,.docx,.txt"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {reportStatus && (
        <p className="text-xs text-slate-400">{reportStatus}</p>
      )}

      {/* Upload progress / error */}
      {uploadProgress && (
        <p className="text-xs text-orange-400 animate-pulse">{uploadProgress}</p>
      )}
      {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}

      {/* Evidence list */}
      {evidence.length === 0 && !uploadProgress && (
        <p className="text-xs text-slate-500 italic">No evidence uploaded yet.</p>
      )}

      <ul className="space-y-2">
        {evidence.map((item) => (
          <li
            key={item.evidenceId}
            className="flex items-start justify-between gap-3 rounded-md bg-slate-700/40 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm text-white/90 truncate">{item.fileName}</p>
              <p className="text-xs text-slate-500">
                {item.kind} · {formatBytes(item.byteSize)} ·{" "}
                <span className={STATUS_STYLES[item.status]}>
                  {STATUS_LABELS[item.status]}
                </span>
              </p>
              {item.label && (
                <p className="text-xs text-slate-500 italic">{item.label}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                onClick={() => handleDownload(item.evidenceId)}
                className="rounded px-2 py-0.5 text-xs text-slate-400 hover:text-white hover:bg-slate-600"
                title="Download"
              >
                ↓
              </button>
              <button
                onClick={() => openCustodyModal(item.evidenceId)}
                className="rounded px-2 py-0.5 text-xs text-slate-400 hover:text-white hover:bg-slate-600"
                title="Chain of custody"
              >
                CoC
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Chain-of-custody modal */}
      {custodyEvidenceId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setCustodyEvidenceId(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-white/10 bg-slate-800 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white">Chain of Custody</h4>
              <button
                onClick={() => setCustodyEvidenceId(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            {loadingCustody ? (
              <p className="text-xs text-slate-400">Loading…</p>
            ) : custodyChain.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No custody records found.</p>
            ) : (
              <ol className="space-y-3">
                {custodyChain.map((c, i) => (
                  <li key={c.custodyId} className="flex gap-3 text-xs">
                    <span className="flex-none w-5 h-5 rounded-full bg-orange-600/30 text-orange-400 flex items-center justify-center font-medium">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-white/80">
                        {c.fromCustodianLabel} → {c.toCustodianLabel}
                      </p>
                      <p className="text-slate-500">{c.reason}</p>
                      <p className="text-slate-600">
                        {new Date(c.transferredAt).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}

      {/* Secure share modal */}
      {showShareModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowShareModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-white/10 bg-slate-800 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white">Secure Share</h4>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Recipient email (optional)
                </label>
                <input
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  type="email"
                  placeholder="recipient@agency.gov"
                  className="w-full rounded bg-slate-600 px-2.5 py-1.5 text-sm text-white placeholder-slate-400 border border-white/10 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Note (optional)</label>
                <textarea
                  value={shareNote}
                  onChange={(e) => setShareNote(e.target.value)}
                  rows={2}
                  placeholder="Context for recipient…"
                  className="w-full rounded bg-slate-600 px-2.5 py-1.5 text-sm text-white placeholder-slate-400 border border-white/10 focus:outline-none resize-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              {shareResult && (
                <div className="rounded bg-slate-700 p-2">
                  {shareResult.startsWith("Error") ? (
                    <p className="text-xs text-red-400">{shareResult}</p>
                  ) : (
                    <>
                      <p className="text-xs text-green-400 mb-1">Share link created (72 h):</p>
                      <a
                        href={shareResult}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-orange-400 break-all underline"
                      >
                        {shareResult}
                      </a>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowShareModal(false)}
                className="rounded px-3 py-1.5 text-xs bg-slate-700 text-slate-200 hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleShare}
                className="rounded px-3 py-1.5 text-xs bg-orange-600 text-white hover:bg-orange-500"
              >
                Create Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
