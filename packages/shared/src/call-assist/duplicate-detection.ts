/**
 * NEXiQ City Services — Duplicate Detection
 *
 * When a new service request is submitted, compare it against recent open SRs
 * to surface potential duplicates before creating a new record.
 *
 * Account: 158961537080 (nexcortiq-prod). Never reference 621957412915.
 *
 * Gate: `config.duplicateDetectionEnabled === true`.
 *       When the flag is off, submission proceeds unchanged.
 *
 * Version: Phase 3 initial implementation.
 *
 * IMPORTANT: Duplicate detection is advisory — it never blocks submission.
 * Operators and callers always have final say. The engine surfaces candidates;
 * the confirmation loop (Phase 1) handles the DUPLICATE_REQUEST_INQUIRY flow.
 */

import type { CallAssistCallRecord } from "./call-record.js";

// ---------------------------------------------------------------------------
// Feature flag gate
// ---------------------------------------------------------------------------

export function isDuplicateDetectionEnabled(
  config: { duplicateDetectionEnabled?: boolean } | null | undefined,
): boolean {
  return config?.duplicateDetectionEnabled === true;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DuplicateCandidate = {
  confirmationNumber: string;
  department?: string;
  status: string;
  createdAt?: string;
  /** Address of the existing SR, normalised to lowercase. */
  addressLower?: string;
  /** 0–1 similarity score. 1.0 = exact match on all signals. */
  score: number;
  /** Human-readable explanation of why this was flagged. */
  reason: string;
};

export type DuplicateCheckInput = {
  /** The new SR being submitted. */
  newRecord: {
    agencyId: string;
    /** Maps to `department` field on CallAssistCallRecord. */
    department?: string;
    incidentLocation?: string;
    issueDescription?: string;
    incidentType?: string;
  };
  /** Candidate SRs from the same agency — typically recent open records. */
  candidates: CallAssistCallRecord[];
  /**
   * Time window to check: only consider candidates created within this many
   * minutes. Default: 2880 (48 hours).
   */
  windowMinutes?: number;
  /**
   * Minimum score (0–1) to report a candidate as a duplicate.
   * Default: 0.6
   */
  threshold?: number;
};

export type DuplicateCheckResult = {
  hasDuplicates: boolean;
  candidates: DuplicateCandidate[];
  /** Highest score found. 0 when no candidates are above threshold. */
  topScore: number;
};

// ---------------------------------------------------------------------------
// Address normalisation
// ---------------------------------------------------------------------------

/** Tokenise an address for fuzzy matching (remove punctuation, lowercase). */
export function tokenizeAddress(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/** Jaccard similarity between two token sets. Returns 0–1. */
export function jaccardSimilarity(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Terminal statuses for which an existing SR would not be a live duplicate. */
const TERMINAL = new Set(["CLOSED", "CANCELLED", "DUPLICATE"]);

/**
 * Score a single candidate against the new SR.
 *
 * Signal weights:
 *  - Department match:   0.4
 *  - Address similarity: 0.4  (Jaccard on tokens)
 *  - Issue type match:   0.2
 *
 * Returns null when the candidate should be skipped (terminal status or
 * outside the time window).
 */
export function scoreDuplicateCandidate(
  newRecord: DuplicateCheckInput["newRecord"],
  candidate: CallAssistCallRecord,
  windowMinutes: number,
): DuplicateCandidate | null {
  if (TERMINAL.has(candidate.status)) return null;

  // Time window check
  if (candidate.createdAt) {
    const ageMs = Date.now() - new Date(candidate.createdAt).getTime();
    if (ageMs > windowMinutes * 60 * 1_000) return null;
  }

  const deptScore = newRecord.department && candidate.department === newRecord.department ? 0.4 : 0;

  const newAddr = tokenizeAddress(newRecord.incidentLocation);
  const candAddr = tokenizeAddress(
    candidate.addressLower ?? candidate.incidentLocation,
  );
  const addrScore = jaccardSimilarity(newAddr, candAddr) * 0.4;

  const newIssue = (newRecord.incidentType ?? "").toLowerCase();
  const candIssue = (candidate.incidentType ?? "").toLowerCase();
  const issueScore =
    newIssue && candIssue && (newIssue === candIssue || newIssue.includes(candIssue) || candIssue.includes(newIssue))
      ? 0.2
      : 0;

  const score = Math.round((deptScore + addrScore + issueScore) * 100) / 100;

  const reasons: string[] = [];
  if (deptScore > 0) reasons.push("same department");
  if (addrScore >= 0.3) reasons.push("similar address");
  if (issueScore > 0) reasons.push("same issue type");

  return {
    confirmationNumber: candidate.confirmationNumber,
    department: candidate.department ?? undefined,
    status: candidate.status,
    createdAt: candidate.createdAt ?? undefined,
    addressLower: candAddr.join(" ") || undefined,
    score,
    reason: reasons.length ? reasons.join("; ") : "low similarity",
  };
}

/**
 * Run duplicate detection against a list of candidate SRs.
 *
 * This is a pure function — no DynamoDB access. The caller (store layer)
 * is responsible for fetching candidate records within the query window.
 */
export function checkForDuplicates(input: DuplicateCheckInput): DuplicateCheckResult {
  const windowMinutes = input.windowMinutes ?? 2880;
  const threshold = input.threshold ?? 0.6;

  const matches: DuplicateCandidate[] = [];

  for (const candidate of input.candidates) {
    if (candidate.agencyId !== input.newRecord.agencyId) continue; // Cross-tenant guard
    const scored = scoreDuplicateCandidate(input.newRecord, candidate, windowMinutes);
    if (scored && scored.score >= threshold) {
      matches.push(scored);
    }
  }

  matches.sort((a, b) => b.score - a.score);
  const topScore = matches[0]?.score ?? 0;

  return {
    hasDuplicates: matches.length > 0,
    candidates: matches,
    topScore,
  };
}

// ---------------------------------------------------------------------------
// Voice/SMS text for duplicate surfacing
// ---------------------------------------------------------------------------

/**
 * Returns a voice phrase to read the top duplicate candidate to the caller
 * before creating a new record.
 */
export function duplicateCandidateVoice(candidate: DuplicateCandidate): string {
  return (
    `I see a similar report on file — number ${candidate.confirmationNumber}, ` +
    `currently ${candidate.status.toLowerCase().replace(/_/g, " ")}. ` +
    `Would you like to add information to that report instead of creating a new one?`
  );
}

/**
 * Returns a short SMS text for surfacing a duplicate to a citizen.
 */
export function duplicateCandidateSms(candidate: DuplicateCandidate): string {
  return (
    `Your issue may already be on file as report ${candidate.confirmationNumber} ` +
    `(status: ${candidate.status}). Reply YES to link to it, NO to file a new report.`
  );
}
