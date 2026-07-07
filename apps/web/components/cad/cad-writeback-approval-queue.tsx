"use client";

/**
 * CadWritebackApprovalQueue
 *
 * Phase 6 — Supervisor approval queue for CAD write-back submissions.
 *
 * Layout: two sections stacked vertically
 *   1. Pending approvals (oldest first — FIFO — supervisor clears from top)
 *   2. Recently completed (last 24h — shows approved/rejected with audit info)
 *
 * Key constraints from the API:
 *  - Supervisor CANNOT approve their own submission (403 with "own" in message)
 *  - Reject requires a reason string (enforced client-side: minimum 3 words)
 *  - Approve accepts optional { notes } for the audit record
 *  - Both return 200 { ok } on success or 502 if vendor CAD rejected (still audited)
 *
 * Endpoints:
 *   GET    /api/admin/cad-writeback-approvals?status=pending_approval  → { items }
 *   GET    /api/admin/cad-writeback-approvals?status=completed&hours=24 → { items }
 *   POST   /api/admin/cad-writeback-approvals/{id}/approve   body: { notes? }
 *   POST   /api/admin/cad-writeback-approvals/{id}/reject    body: { reason }
 *
 * Role gate: supervisor | agency_admin | agency_it
 * Feature gate: NEXT_PUBLIC_ENABLE_CAD_WRITEBACK=1
 */

import { useCallback, useEffect, useState } from "react";
import {
  fetchCadWritebackApprovals,
  postCadWritebackApprove,
  postCadWritebackReject,
} from "@/lib/api";
import {
  auditRecordToApprovalItem,
  type WritebackApprovalItem,
} from "@/lib/cad/writeback-ui";
import { isCadWritebackUiEnabled } from "@/lib/runtime-flags";

// ─── Design tokens ────────────────────────────────────────────────────────────

const V = {
  bg:          "#09080f",
  surface:     "#0f0d1a",
  surfaceAlt:  "#141220",
  surfaceHov:  "#1a1730",
  border:      "#1e1a30",
  textPrimary: "#e4dff5",
  textSec:     "#9b91bb",
  textMuted:   "#5a4d7a",
  violet:      "#7c3aed",
  amber:       "#f59e0b",
  amberBg:     "#1c1000",
  amberBorder: "#92400e",
  amberText:   "#fcd34d",
  green:       "#10b981",
  greenBg:     "#052e16",
  greenBorder: "#166534",
  red:         "#ef4444",
  redBg:       "#1f0808",
  redBorder:   "#991b1b",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

// ─── Individual approval row ──────────────────────────────────────────────────

function PendingRow({
  item,
  currentUserId,
  onAction,
}: {
  item: WritebackApprovalItem;
  currentUserId?: string;
  onAction: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [approveNotes, setApproveNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState<"approve" | "reject" | null>(null);
  const [actionResult, setActionResult] = useState<
    | { ok: true; action: "approved" | "rejected" }
    | { ok: false; message: string }
    | null
  >(null);
  const [attested, setAttested] = useState(false);

  const isOwnSubmission = !!currentUserId && currentUserId === item.submittedBy;
  const canAct = !isOwnSubmission && !actionResult?.ok;

  const rejectWordCount = wordCount(rejectReason);
  const rejectValid = rejectWordCount >= 2;

  async function act(action: "approve" | "reject") {
    if (action === "reject" && !rejectValid) return;
    if (action === "approve" && !attested) return;

    setActing(action);
    try {
      const body =
        action === "approve"
          ? { notes: approveNotes.trim() || undefined }
          : { notes: rejectReason.trim() };

      const result =
        action === "approve"
          ? await postCadWritebackApprove(item.id, body)
          : await postCadWritebackReject(item.id, body);

      if (action === "approve" && "error" in result && result.error && !result.ok) {
        setActionResult({ ok: false, message: String(result.error ?? "Unknown error") });
        return;
      }

      setActionResult({ ok: true, action: action === "approve" ? "approved" : "rejected" });
      onAction();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Network error";
      if (message.toLowerCase().includes("own") || message.toLowerCase().includes("cannot approve")) {
        setActionResult({
          ok: false,
          message: "You cannot approve your own write-back submission.",
        });
        return;
      }
      setActionResult({ ok: false, message });
    } finally {
      setActing(null);
    }
  }

  if (actionResult?.ok) {
    return (
      <div style={{
        padding: "10px 14px",
        background: actionResult.action === "approved" ? V.greenBg : V.surfaceAlt,
        border: `1px solid ${actionResult.action === "approved" ? V.greenBorder : V.border}`,
        borderRadius: 7, display: "flex", alignItems: "center", gap: 10, marginBottom: 8,
      }}>
        <span style={{ fontSize: 16 }}>{actionResult.action === "approved" ? "✓" : "✕"}</span>
        <div>
          <div style={{
            fontSize: 12, fontWeight: 700,
            color: actionResult.action === "approved" ? V.green : V.textSec,
          }}>
            {actionResult.action === "approved" ? "Approved — sending to CAD" : "Rejected"}
          </div>
          <div style={{ fontSize: 11, color: V.textMuted }}>
            {item.submittedByName ?? item.submittedBy} · {item.incidentType} · {relTime(item.submittedAt)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      border: `1px solid ${expanded ? V.amber + "66" : V.border}`,
      borderLeft: `3px solid ${isOwnSubmission ? V.border : V.amber}`,
      borderRadius: 8, marginBottom: 8, overflow: "hidden",
      background: V.surface,
    }}>
      {/* Summary row */}
      <div
        style={{ padding: "11px 14px", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start" }}
        onClick={() => setExpanded((p) => !p)}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: V.textPrimary }}>
              {item.incidentType ?? "Unknown type"}
            </span>
            {item.cadNatureCode && (
              <span style={{
                fontSize: 10, fontFamily: "monospace", color: V.amberText,
                background: V.amberBg, border: `1px solid ${V.amberBorder}`,
                borderRadius: 3, padding: "1px 5px",
              }}>
                {item.cadNatureCode}
              </span>
            )}
            {isOwnSubmission && (
              <span style={{
                fontSize: 10, color: V.textMuted, background: V.surfaceAlt,
                border: `1px solid ${V.border}`, borderRadius: 3, padding: "1px 5px",
              }}>
                Your submission
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: V.textSec, marginBottom: 3, lineHeight: 1.4 }}>
            {item.narrative.length > 120
              ? item.narrative.slice(0, 120) + "…"
              : item.narrative}
          </div>
          <div style={{ display: "flex", gap: 10, fontSize: 10, color: V.textMuted }}>
            <span>{item.submittedByName ?? item.submittedBy}</span>
            <span>·</span>
            <span>{relTime(item.submittedAt)}</span>
            {item.incidentLocation && (
              <>
                <span>·</span>
                <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.incidentLocation}
                </span>
              </>
            )}
          </div>
        </div>
        <span style={{ color: V.textMuted, fontSize: 14, flexShrink: 0 }}>{expanded ? "▾" : "▸"}</span>
      </div>

      {/* Expanded detail + action panel */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${V.border}`, padding: "12px 14px" }}>
          {/* Full narrative */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: V.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 5 }}>
              Full narrative
            </div>
            <div style={{
              padding: "10px 12px",
              background: V.bg, border: `1px solid ${V.border}`, borderRadius: 6,
              fontSize: 13, color: V.textPrimary, lineHeight: 1.6,
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {item.narrative}
            </div>
          </div>

          {/* Metadata grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
            {[
              { label: "CAD incident ID", value: item.cadIncidentId },
              { label: "Priority", value: item.priority },
              { label: "Units", value: item.units },
              { label: "Internal notes", value: item.notes },
            ].filter((r) => r.value).map((row) => (
              <div key={row.label}>
                <div style={{ fontSize: 9, color: V.textMuted, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>
                  {row.label}
                </div>
                <div style={{ fontSize: 11, color: V.textSec }}>{row.value}</div>
              </div>
            ))}
          </div>

          {/* Cannot approve own */}
          {isOwnSubmission && (
            <div style={{
              padding: "10px 12px", background: V.surfaceAlt,
              border: `1px solid ${V.border}`, borderRadius: 6,
              fontSize: 12, color: V.textMuted, marginBottom: 12,
            }}>
              You submitted this request. A different supervisor or Agency IT must approve or reject it.
            </div>
          )}

          {/* Action error */}
          {actionResult && !actionResult.ok && (
            <div style={{
              padding: "8px 10px", background: V.redBg, border: `1px solid ${V.redBorder}`,
              borderRadius: 5, fontSize: 12, color: "#fca5a5", marginBottom: 10,
            }}>
              {actionResult.message}
            </div>
          )}

          {/* Approve section */}
          {canAct && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Attestation */}
              <label style={{
                display: "flex", gap: 9, alignItems: "flex-start", cursor: "pointer",
                padding: "10px 12px",
                background: attested ? "#0a1a10" : V.amberBg,
                border: `1px solid ${attested ? V.greenBorder : V.amberBorder}`,
                borderRadius: 6, transition: "all 0.15s",
              }}>
                <input
                  type="checkbox"
                  checked={attested}
                  onChange={(e) => setAttested(e.target.checked)}
                  style={{ marginTop: 1, flexShrink: 0, accentColor: V.green }}
                />
                <span style={{ fontSize: 12, color: attested ? "#86efac" : V.amberText, lineHeight: 1.5 }}>
                  I have reviewed this update and confirm it is accurate and appropriate to send to CAD.
                </span>
              </label>

              {/* Approve + optional notes */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                <input
                  type="text"
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  placeholder="Approval notes (optional — added to audit record)"
                  style={{
                    padding: "8px 10px", background: V.surfaceAlt,
                    border: `1px solid ${V.border}`, borderRadius: 5,
                    color: V.textPrimary, fontSize: 12, outline: "none",
                  }}
                />
                <button
                  type="button"
                  disabled={!attested || acting === "approve"}
                  onClick={() => void act("approve")}
                  style={{
                    padding: "8px 18px",
                    background: attested ? V.green : V.surfaceAlt,
                    border: `1px solid ${attested ? V.greenBorder : V.border}`,
                    borderRadius: 5, color: attested ? "#052e16" : V.textMuted,
                    fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap",
                  }}
                >
                  {acting === "approve" ? "Approving…" : "✓ Approve"}
                </button>
              </div>

              {/* Reject + required reason */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                <div>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Rejection reason (required — at least 2 words)"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      padding: "8px 10px", background: V.surfaceAlt,
                      border: `1px solid ${rejectReason && !rejectValid ? V.red : V.border}`,
                      borderRadius: 5, color: V.textPrimary, fontSize: 12, outline: "none",
                    }}
                  />
                  {rejectReason && !rejectValid && (
                    <div style={{ fontSize: 10, color: V.red, marginTop: 2 }}>
                      Reason must be at least 2 words
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!rejectValid || acting === "reject"}
                  onClick={() => void act("reject")}
                  style={{
                    padding: "8px 18px",
                    background: rejectValid ? V.redBg : V.surfaceAlt,
                    border: `1px solid ${rejectValid ? V.redBorder : V.border}`,
                    borderRadius: 5, color: rejectValid ? "#fca5a5" : V.textMuted,
                    fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                  }}
                >
                  {acting === "reject" ? "Rejecting…" : "✕ Reject"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Completed row ────────────────────────────────────────────────────────────

function CompletedRow({ item }: { item: WritebackApprovalItem }) {
  const approved = item.status === "approved";
  const vendorRejected = item.status === "vendor_rejected";

  return (
    <div style={{
      padding: "9px 12px",
      background: V.surfaceAlt,
      border: `1px solid ${V.border}`,
      borderLeft: `3px solid ${approved ? V.greenBorder : vendorRejected ? V.amberBorder : V.redBorder}`,
      borderRadius: 6, marginBottom: 6,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <span style={{
        fontSize: 14,
        color: approved ? V.green : vendorRejected ? V.amber : V.red,
      }}>
        {approved ? "✓" : vendorRejected ? "⚠" : "✕"}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: V.textPrimary, fontWeight: 600 }}>
          {item.incidentType ?? "Incident"}
          {" · "}
          <span style={{ color: approved ? V.green : vendorRejected ? V.amber : V.red, fontWeight: 700 }}>
            {vendorRejected ? "Vendor rejected" : item.status === "approved" ? "Approved" : "Rejected"}
          </span>
        </div>
        <div style={{ fontSize: 11, color: V.textMuted, marginTop: 2 }}>
          {item.submittedByName ?? item.submittedBy} submitted · reviewed by {item.reviewedByName ?? item.reviewedBy ?? "—"} · {item.reviewedAt ? relTime(item.reviewedAt) : "—"}
          {item.reviewNotes && ` · "${item.reviewNotes}"`}
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────────

export interface CadWritebackApprovalQueueProps {
  currentUserId?: string;
  /** Whether to auto-refresh. Default: true */
  autoRefresh?: boolean;
}

export function CadWritebackApprovalQueue({
  currentUserId,
  autoRefresh = true,
}: CadWritebackApprovalQueueProps) {
  const [pending, setPending]     = useState<WritebackApprovalItem[]>([]);
  const [completed, setCompleted] = useState<WritebackApprovalItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [pendingRes, historyRes] = await Promise.all([
        fetchCadWritebackApprovals({ status: "pending_approval" }),
        fetchCadWritebackApprovals({ since: "24h" }),
      ]);

      const sortedPending = [...pendingRes.items.map(auditRecordToApprovalItem)].sort(
        (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
      );
      setPending(sortedPending);
      setCompleted(
        historyRes.items
          .filter((row) => row.status !== "pending_approval")
          .map(auditRecordToApprovalItem),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load approval queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    if (!autoRefresh) return;
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load, autoRefresh]);

  const enabled = isCadWritebackUiEnabled();

  if (!enabled) {
    return (
      <div style={{ padding: "20px 0", textAlign: "center", fontSize: 12, color: V.textMuted }}>
        CAD write-back is not enabled for this environment.
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14, gap: 10 }}>
        <div style={{ flex: 1 }}>
          {pending.length > 0 && (
            <span style={{
              fontSize: 12, fontWeight: 700, color: V.amberText,
              background: V.amberBg, border: `1px solid ${V.amberBorder}`,
              borderRadius: 5, padding: "3px 10px",
            }}>
              {pending.length} pending approval{pending.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          style={{
            padding: "6px 12px", background: "transparent",
            border: `1px solid ${V.border}`, borderRadius: 5,
            color: V.textMuted, fontSize: 11, cursor: "pointer",
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div style={{
          padding: "10px 12px", background: V.redBg,
          border: `1px solid ${V.redBorder}`, borderRadius: 6,
          fontSize: 12, color: "#fca5a5", marginBottom: 12,
        }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ padding: 20, textAlign: "center", color: V.textMuted, fontSize: 12 }}>
          Loading queue…
        </div>
      )}

      {/* Pending */}
      {!loading && (
        <>
          {pending.length === 0 ? (
            <div style={{
              padding: "20px 14px", textAlign: "center",
              border: `1px dashed ${V.border}`, borderRadius: 8, marginBottom: 16,
            }}>
              <div style={{ fontSize: 13, color: V.textMuted }}>No pending approvals</div>
            </div>
          ) : (
            <div style={{ marginBottom: 20 }}>
              {pending.map((item) => (
                <PendingRow
                  key={item.id}
                  item={item}
                  currentUserId={currentUserId}
                  onAction={() => void load()}
                />
              ))}
            </div>
          )}

          {/* Completed (last 24h) */}
          {completed.length > 0 && (
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                textTransform: "uppercase", color: V.textMuted,
                borderBottom: `1px solid ${V.border}`,
                paddingBottom: 5, marginBottom: 10,
              }}>
                Completed — last 24h
              </div>
              {completed.map((item) => (
                <CompletedRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
