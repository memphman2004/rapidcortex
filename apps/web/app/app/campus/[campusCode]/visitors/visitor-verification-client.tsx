"use client";

/**
 * NexCort iQ K-12 — Visitor Verification Console
 *
 * Four capture modes (same pipeline):
 *   1. Camera Scan  — PDF417 barcode via BarcodeDetector API (auto-fills form)
 *   2. OCR Fallback — Send camera frame to Textract when barcode fails
 *   3. Manual Entry — Staff types name + DOB (original flow)
 *   4. (Pre-reg QR  — Future: pre-registration token fast-lane)
 *
 * After check-in: displays NSOPW screening result + signed badge QR.
 * Badge QR → public URL for on-campus verification by any staff member.
 * Emergency roster: every active visitor feeds the accountability dashboard.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Keyboard,
  LogOut,
  QrCode,
  RefreshCw,
  Shield,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useBarcodeScanner } from "@/lib/campus/use-barcode-scanner";
import { looksLikeAamva, parseAamvaString } from "@/lib/campus/use-aamva-parser";
import type { ExtractedIdFields } from "rapid-cortex-shared";

// ─── Types ────────────────────────────────────────────────────────────────────

type Clearance = "cleared" | "flagged" | "review_required";
type CaptureMode = "camera" | "manual";
type IdType = "drivers_license" | "state_id" | "passport" | "military_id" | "other";

interface CheckInResult {
  visitorId: string;
  status: Clearance;
  matchCount: number;
  flagSummary?: string;
  screeningError?: boolean;
  badgeToken: string;
  badgeExpiresAt: string;
  captureMethod: string;
}

interface VisitorRow {
  visitorId: string;
  firstName: string;
  lastName: string;
  status: Clearance;
  checkedInAt: string;
  checkedOutAt?: string | null;
  captureMethod?: string;
  siteId?: string | null;
  buildingCode?: string | null;
  purposeOfVisit?: string;
  badgeToken?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<Clearance, { label: string; icon: typeof CheckCircle2; color: string; bg: string; border: string }> = {
  cleared:        { label: "Cleared for entry",        icon: CheckCircle2, color: "text-green-400",  bg: "bg-green-950/30",  border: "border-green-800/50" },
  flagged:        { label: "Hold — notify administrator", icon: AlertTriangle, color: "text-red-400", bg: "bg-red-950/30",    border: "border-red-800/50" },
  review_required:{ label: "Manual review required",   icon: Clock,        color: "text-amber-400", bg: "bg-amber-950/30", border: "border-amber-800/50" },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function badgeVerifyUrl(badgeToken: string): string {
  if (typeof window === "undefined") return `/api/campus/badge/${badgeToken}`;
  return `${window.location.origin}/api/campus/badge/${badgeToken}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function VisitorVerificationClient({
  agencyId,
  campusCode,
  agencyName,
}: {
  agencyId: string;
  campusCode: string;
  agencyName: string;
}) {
  const [mode, setMode] = useState<CaptureMode>("camera");
  const [idType, setIdType] = useState<IdType>("drivers_license");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [idExpiresAt, setIdExpiresAt] = useState("");
  const [issuingState, setIssuingState] = useState("");
  const [extractedFields, setExtractedFields] = useState<ExtractedIdFields | null>(null);
  const [rawIdNumber, setRawIdNumber] = useState<string | null>(null); // server-side hash only
  const [purpose, setPurpose] = useState("");
  const [visitingStaff, setVisitingStaff] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [scanState, setScanState] = useState<"idle" | "scanning" | "captured" | "ocr_fallback">("idle");

  // ── Barcode scanner ────────────────────────────────────────────────────────

  const onDetected = useCallback(
    (rawValue: string) => {
      if (!looksLikeAamva(rawValue)) return;
      const parsed = parseAamvaString(rawValue);
      if (!parsed) return;

      // Extract raw ID number for server-side hashing (never stored client-side)
      import("@/lib/campus/use-aamva-parser").then(({ extractRawIdNumber }) => {
        const raw = extractRawIdNumber(rawValue);
        setRawIdNumber(raw);
      });

      setExtractedFields(parsed);
      setFirstName(parsed.firstName ?? "");
      setLastName(parsed.lastName ?? "");
      setDob(parsed.dob ?? "");
      setIdExpiresAt(parsed.idExpiresAt ?? "");
      setIssuingState(parsed.issuingState ?? "");
      setScanState("captured");
    },
    [],
  );

  const { scanning, supported, videoRef, canvasRef, start, stop, error: cameraError, captureFrame } =
    useBarcodeScanner({
      onDetected,
      formats: ["pdf417", "qr_code", "code_128"],
    });

  // ── OCR fallback ───────────────────────────────────────────────────────────

  const runOcrFallback = useCallback(async () => {
    const frame = captureFrame();
    if (!frame) {
      setScanState("ocr_fallback");
      return;
    }
    setOcrLoading(true);
    stop();
    try {
      const res = await fetch(`/api/campus/${encodeURIComponent(agencyId)}/visitors/extract-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: frame, mimeType: "image/jpeg" }),
      });
      const data = (await res.json()) as { success?: boolean; fields?: ExtractedIdFields };
      if (data.success && data.fields) {
        setExtractedFields(data.fields);
        setFirstName(data.fields.firstName ?? "");
        setLastName(data.fields.lastName ?? "");
        setDob(data.fields.dob ?? "");
        setIdExpiresAt(data.fields.idExpiresAt ?? "");
        setIssuingState(data.fields.issuingState ?? "");
        setScanState("captured");
      } else {
        setScanState("ocr_fallback");
      }
    } catch {
      setScanState("ocr_fallback");
    } finally {
      setOcrLoading(false);
    }
  }, [agencyId, captureFrame, stop]);

  // ── Visitor list ───────────────────────────────────────────────────────────

  const loadVisitors = useCallback(() => {
    void fetch(`/api/campus/${encodeURIComponent(agencyId)}/visitors`, { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : { visitors: [] }))
      .then((b: { visitors?: VisitorRow[] }) => setVisitors(b.visitors ?? []))
      .catch(() => setVisitors([]));
  }, [agencyId]);

  useEffect(() => {
    loadVisitors();
    const id = window.setInterval(loadVisitors, 30_000);
    return () => window.clearInterval(id);
  }, [loadVisitors]);

  // ── Sign-out ───────────────────────────────────────────────────────────────

  const signOut = useCallback(
    async (visitorId: string) => {
      await fetch(
        `/api/campus/${encodeURIComponent(agencyId)}/visitors/${encodeURIComponent(visitorId)}/sign-out`,
        { method: "POST" },
      );
      loadVisitors();
    },
    [agencyId, loadVisitors],
  );

  // ── Check-in submit ────────────────────────────────────────────────────────

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const captureMethod = extractedFields?.captureMethod ?? "manual";
      const payload: Record<string, unknown> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        idType,
        purposeOfVisit: purpose.trim(),
        visitingStaff: visitingStaff.trim() || undefined,
        captureMethod,
      };

      // Include scan-enriched fields if available
      if (extractedFields) {
        payload.dob = dob || undefined;
        payload.idExpiresAt = idExpiresAt || undefined;
        payload.issuingState = issuingState || undefined;
        payload.documentExpired = extractedFields.documentExpired;
        // Server will hash the ID number; pass it here if captured from barcode
        if (rawIdNumber) {
          // We pass a flag indicating ID number is available for server-side hashing
          // The actual hash happens in campus-visitors-service
          payload.idNumberRaw = rawIdNumber;
        }
      }

      const res = await fetch(
        `/api/campus/${encodeURIComponent(agencyId)}/visitors/check-in`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = (await res.json()) as CheckInResult & { error?: string };
      if (!res.ok) {
        setResult({
          visitorId: "",
          status: "review_required",
          matchCount: 0,
          screeningError: true,
          badgeToken: "",
          badgeExpiresAt: "",
          captureMethod: "manual",
        });
      } else {
        setResult(body);
        // Reset form
        setFirstName("");
        setLastName("");
        setDob("");
        setIdExpiresAt("");
        setIssuingState("");
        setPurpose("");
        setVisitingStaff("");
        setExtractedFields(null);
        setRawIdNumber(null);
        setScanState("idle");
        loadVisitors();
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const statusConfig = result ? STATUS_CONFIG[result.status] : null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

      {/* ── Left panel: Check-in form ─────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Visitor Check-In</h2>
            <p className="text-xs text-slate-400">{agencyName} — NSOPW screening runs server-side</p>
          </div>
          {/* Mode selector */}
          <div className="flex rounded-lg border border-slate-700 bg-slate-900 p-0.5">
            <button
              onClick={() => { setMode("camera"); setScanState("idle"); }}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === "camera"
                  ? "bg-sky-700 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              Scan ID
            </button>
            <button
              onClick={() => { setMode("manual"); stop(); setScanState("idle"); }}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === "manual"
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Keyboard className="h-3.5 w-3.5" />
              Manual
            </button>
          </div>
        </div>

        {/* Camera scanner */}
        {mode === "camera" && scanState !== "captured" && (
          <div className="mb-4">
            <div className="relative overflow-hidden rounded-lg bg-black aspect-video">
              {/* Hidden canvas for frame capture */}
              <canvas ref={canvasRef as React.RefObject<HTMLCanvasElement>} className="hidden" />
              <video
                ref={videoRef as React.RefObject<HTMLVideoElement>}
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {!scanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/80">
                  <Camera className="h-10 w-10 text-slate-500" />
                  <p className="text-sm text-slate-400">
                    {supported
                      ? "Point camera at the barcode on the back of the ID"
                      : "Camera scanning not available in this browser"}
                  </p>
                  {supported && (
                    <button
                      onClick={() => { setScanState("scanning"); void start(); }}
                      className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
                    >
                      Start Camera
                    </button>
                  )}
                  {!supported && (
                    <button
                      onClick={() => setMode("manual")}
                      className="text-xs text-sky-400 underline"
                    >
                      Switch to manual entry
                    </button>
                  )}
                </div>
              )}
              {scanning && (
                <>
                  {/* Scan guide overlay */}
                  <div className="absolute inset-4 rounded-lg border-2 border-sky-400/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                    <button
                      onClick={() => { stop(); setScanState("idle"); }}
                      className="rounded-md border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void runOcrFallback()}
                      disabled={ocrLoading}
                      className="rounded-md border border-amber-700/50 bg-amber-900/60 px-3 py-1.5 text-xs text-amber-200"
                    >
                      {ocrLoading ? "Analyzing…" : "Barcode won't scan? Use OCR"}
                    </button>
                  </div>
                </>
              )}
            </div>
            {cameraError && (
              <p className="mt-2 text-xs text-red-400">{cameraError}</p>
            )}
            {scanState === "ocr_fallback" && (
              <p className="mt-2 text-xs text-amber-400">
                OCR extraction unavailable. Enter details manually below.
              </p>
            )}
          </div>
        )}

        {/* Captured badge */}
        {mode === "camera" && scanState === "captured" && extractedFields && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-green-800/50 bg-green-950/20 px-3 py-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
            <div className="text-xs">
              <p className="font-semibold text-green-200">
                ID captured via {extractedFields.captureMethod === "barcode" ? "barcode scan" : "OCR"}
              </p>
              <p className="text-slate-400">
                {extractedFields.firstName} {extractedFields.lastName}
                {extractedFields.issuingState ? ` · ${extractedFields.issuingState}` : ""}
                {extractedFields.documentExpired ? " · ⚠️ Expired ID" : ""}
              </p>
            </div>
            <button
              onClick={() => { setExtractedFields(null); setScanState("idle"); setFirstName(""); setLastName(""); setDob(""); }}
              className="ml-auto text-xs text-slate-500 hover:text-slate-300"
            >
              Re-scan
            </button>
          </div>
        )}

        {/* Expired ID warning */}
        {extractedFields?.documentExpired && (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-700/50 bg-amber-950/20 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <p className="text-xs text-amber-200">
              This ID expired on {idExpiresAt}. Document is no longer valid. Use manual entry and note the expired ID.
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">First name *</label>
              <input
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600"
                placeholder="First"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Last name *</label>
              <input
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600"
                placeholder="Last"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">ID type</label>
              <select
                value={idType}
                onChange={(e) => setIdType(e.target.value as IdType)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                <option value="drivers_license">Driver License</option>
                <option value="state_id">State ID</option>
                <option value="passport">Passport</option>
                <option value="military_id">Military ID</option>
                <option value="other">Other</option>
              </select>
            </div>
            {dob && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Date of birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Purpose of visit *</label>
            <input
              required
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600"
              placeholder="e.g. Meeting with principal, dropping off student"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Visiting staff (optional)</label>
            <input
              value={visitingStaff}
              onChange={(e) => setVisitingStaff(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600"
              placeholder="Teacher or staff member"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-sky-700 py-2.5 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
          >
            {submitting ? "Screening…" : "Check In & Screen"}
          </button>
        </form>

        {/* Result */}
        {result && statusConfig && (
          <div className={`mt-4 rounded-lg border p-4 ${statusConfig.border} ${statusConfig.bg}`}>
            <div className={`flex items-center gap-2 font-semibold ${statusConfig.color}`}>
              <statusConfig.icon className="h-4 w-4" />
              {statusConfig.label}
            </div>
            {result.flagSummary && (
              <p className="mt-1 text-xs text-slate-300">{result.flagSummary}</p>
            )}
            {result.status === "flagged" && (
              <p className="mt-2 text-xs text-red-300">
                AI screening advisory — human staff make all access decisions. Never deny entry
                based solely on this result without manual review.
              </p>
            )}
            {result.badgeToken && result.status !== "flagged" && (
              <div className="mt-3 border-t border-slate-700/50 pt-3">
                <p className="text-xs font-medium text-slate-300">
                  <QrCode className="inline h-3.5 w-3.5 mr-1" />
                  Badge QR
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Expires {new Date(result.badgeExpiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Any staff can scan to verify on-campus
                </p>
                <code className="mt-1 block break-all text-xs text-sky-300">
                  {badgeVerifyUrl(result.badgeToken)}
                </code>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right panel: Today's visitors ─────────────────────────────────── */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">
            On Campus Today
            {visitors.filter((v) => !v.checkedOutAt).length > 0 && (
              <span className="ml-2 rounded-full bg-sky-700 px-2 py-0.5 text-xs font-bold text-white">
                {visitors.filter((v) => !v.checkedOutAt).length} active
              </span>
            )}
          </h2>
          <button
            onClick={loadVisitors}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>

        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
          {visitors.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No check-ins yet today.</p>
          ) : (
            visitors.map((v) => (
              <VisitorCard
                key={v.visitorId}
                visitor={v}
                onSignOut={() => void signOut(v.visitorId)}
              />
            ))
          )}
        </div>

        {/* Emergency accountability note */}
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-slate-700/40 bg-slate-900/50 px-3 py-2">
          <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
          <p className="text-xs text-slate-500">
            All active visitors appear in the emergency accountability roster. During a lockdown
            or evacuation, the command dashboard shows exact check-in location and host.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Visitor Card ─────────────────────────────────────────────────────────────

function VisitorCard({
  visitor,
  onSignOut,
}: {
  visitor: VisitorRow;
  onSignOut: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isActive = !visitor.checkedOutAt;
  const statusColors: Record<Clearance, string> = {
    cleared:         "text-green-400",
    flagged:         "text-red-400",
    review_required: "text-amber-400",
  };
  const statusDot: Record<Clearance, string> = {
    cleared:         "bg-green-400",
    flagged:         "bg-red-400",
    review_required: "bg-amber-400",
  };

  return (
    <div className={`rounded-lg border ${isActive ? "border-slate-700/50" : "border-slate-800/30 opacity-60"} bg-slate-900/50`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot[visitor.status]}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">
            {visitor.firstName} {visitor.lastName}
            {!isActive && <span className="ml-2 text-xs text-slate-500">(out)</span>}
          </p>
          <p className="text-xs text-slate-400">
            {formatTime(visitor.checkedInAt)}
            {visitor.purposeOfVisit ? ` · ${visitor.purposeOfVisit}` : ""}
          </p>
        </div>
        <span className={`text-xs font-medium ${statusColors[visitor.status]}`}>
          {visitor.status.replace("_", " ").toUpperCase()}
        </span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-slate-800/50 px-3 pb-3 pt-2 space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400">
            {visitor.visitingStaff && (
              <span><span className="text-slate-500">Visiting: </span>{visitor.visitingStaff}</span>
            )}
            {visitor.captureMethod && (
              <span><span className="text-slate-500">Capture: </span>{visitor.captureMethod}</span>
            )}
            {visitor.buildingCode && (
              <span><span className="text-slate-500">Building: </span>{visitor.buildingCode}</span>
            )}
            {visitor.checkedOutAt && (
              <span><span className="text-slate-500">Signed out: </span>{formatTime(visitor.checkedOutAt)}</span>
            )}
          </div>
          {visitor.badgeToken && isActive && (
            <p className="text-xs text-sky-400 break-all">
              Badge: {badgeVerifyUrl(visitor.badgeToken)}
            </p>
          )}
          {isActive && (
            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          )}
        </div>
      )}
    </div>
  );
}
