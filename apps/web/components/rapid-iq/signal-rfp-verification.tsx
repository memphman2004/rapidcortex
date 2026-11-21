"use client";

/**
 * SignalRfpVerification
 *
 * Displays official RFP source verification status, procurement portal link,
 * solicitation number, bid eligibility, product fit category, and procurement
 * contact email for a NexiQ pipeline signal.
 *
 * Rules enforced (per CURSOR IMPLEMENTATION PROMPT):
 * - Only renders "View Official RFP" when status is VERIFIED.
 * - Renders "View Procurement Portal" when PORTAL_ONLY.
 * - Shows a warning when status is MISMATCH.
 * - Never fabricates or extrapolates procurement links.
 */

import type {
  RapidIqBidEligibilityStatus,
  RapidIqPipelineSignal,
  RapidIqProductFitCategory,
  RapidIqSourceVerificationStatus,
} from "rapid-cortex-shared";

type Props = {
  signal: RapidIqPipelineSignal;
};

// ── Label maps ────────────────────────────────────────────────────────────────

const VERIFICATION_LABELS: Record<RapidIqSourceVerificationStatus, string> = {
  VERIFIED: "Official source verified",
  PORTAL_ONLY: "Procurement portal found",
  UNVERIFIED: "Source not yet verified",
  MISMATCH: "Source mismatch — review required",
};

const VERIFICATION_COLORS: Record<RapidIqSourceVerificationStatus, string> = {
  VERIFIED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  PORTAL_ONLY: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  UNVERIFIED: "border-slate-600/50 bg-slate-800/40 text-slate-400",
  MISMATCH: "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

const ELIGIBILITY_LABELS: Record<RapidIqBidEligibilityStatus, string> = {
  eligible: "Eligible to bid",
  ineligible: "Not eligible to bid",
  requires_registration: "Registration required",
  requires_nda: "NDA required",
  unknown: "Eligibility unknown",
};

const ELIGIBILITY_COLORS: Record<RapidIqBidEligibilityStatus, string> = {
  eligible: "text-emerald-400",
  ineligible: "text-red-400",
  requires_registration: "text-amber-400",
  requires_nda: "text-amber-400",
  unknown: "text-slate-500",
};

const FIT_LABELS: Record<RapidIqProductFitCategory, string> = {
  DIRECT_FIT: "Direct fit",
  PARTNER_OPPORTUNITY: "Partner opportunity",
  LOW_FIT: "Low fit",
};

const FIT_COLORS: Record<RapidIqProductFitCategory, string> = {
  DIRECT_FIT: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  PARTNER_OPPORTUNITY: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  LOW_FIT: "border-slate-600/50 bg-slate-800/40 text-slate-400",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function SignalRfpVerification({ signal }: Props) {
  const hasVerificationData =
    signal.sourceVerificationStatus ||
    signal.officialRfpUrl ||
    signal.officialProcurementPortalUrl ||
    signal.bidEligibilityStatus ||
    signal.productFitCategory ||
    signal.procurementContactEmail ||
    signal.solicitationNumber;

  if (!hasVerificationData) return null;

  const vs = signal.sourceVerificationStatus;
  const isVerified = vs === "VERIFIED";
  const isPortalOnly = vs === "PORTAL_ONLY";
  const isMismatch = vs === "MISMATCH";

  const rfpHref = isVerified ? (signal.officialRfpUrl ?? null) : null;
  const portalHref =
    isPortalOnly || (!isVerified && signal.officialProcurementPortalUrl)
      ? (signal.officialProcurementPortalUrl ?? null)
      : null;

  return (
    <div className="mt-3 rounded border border-slate-700/40 bg-[#0c1a2e] px-2.5 py-2.5">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        Official Source
      </p>

      {/* Mismatch warning — shown at the top */}
      {isMismatch && (
        <div className="mb-2 rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[11px] text-amber-300">
          ⚠ Source mismatch detected — confirm details against the official procurement
          portal before proceeding.
        </div>
      )}

      {/* Verification status badge */}
      {vs && (
        <div className="mb-2 flex items-center gap-1.5">
          <span
            className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${VERIFICATION_COLORS[vs]}`}
          >
            {VERIFICATION_LABELS[vs]}
          </span>
          {signal.sourceVerifiedAt && (
            <span className="text-[9px] text-slate-600">
              as of {signal.sourceVerifiedAt.slice(0, 10)}
            </span>
          )}
        </div>
      )}

      {/* Solicitation number */}
      {signal.solicitationNumber && (
        <p className="mb-1.5 text-[11px] text-slate-400">
          <span className="font-semibold text-slate-300">Solicitation #:</span>{" "}
          {signal.solicitationNumber}
        </p>
      )}

      {/* Official RFP link — only when VERIFIED */}
      {rfpHref && (
        <a
          href={rfpHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-1.5 inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
          onClick={(e) => e.stopPropagation()}
        >
          View Official RFP ↗
        </a>
      )}

      {/* Procurement portal link — when PORTAL_ONLY or verified without direct RFP URL */}
      {portalHref && (
        <a
          href={portalHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-1.5 inline-flex items-center gap-1 rounded border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/20"
          onClick={(e) => e.stopPropagation()}
        >
          View Procurement Portal ↗
        </a>
      )}

      {/* Deadline verified */}
      {signal.deadlineVerifiedAt && (
        <p className="mb-1 text-[10px] text-slate-500">
          Deadline confirmed {signal.deadlineVerifiedAt.slice(0, 10)}
        </p>
      )}

      {/* Bid eligibility + product fit in one row */}
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {signal.bidEligibilityStatus && signal.bidEligibilityStatus !== "unknown" && (
          <span
            className={`text-[10px] font-semibold ${ELIGIBILITY_COLORS[signal.bidEligibilityStatus]}`}
          >
            {ELIGIBILITY_LABELS[signal.bidEligibilityStatus]}
          </span>
        )}
        {signal.productFitCategory && (
          <span
            className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${FIT_COLORS[signal.productFitCategory]}`}
          >
            {FIT_LABELS[signal.productFitCategory]}
          </span>
        )}
      </div>

      {/* Procurement contact email */}
      {signal.procurementContactEmail && (
        <p className="mt-1.5 text-[10px] text-slate-400">
          <span className="font-semibold text-slate-300">Contact:</span>{" "}
          <a
            href={`mailto:${signal.procurementContactEmail}`}
            className="text-sky-400 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {signal.procurementContactEmail}
          </a>
        </p>
      )}
    </div>
  );
}
