/**
 * NEXiQ City Services — Confirmation Loop Lifecycle Helpers
 *
 * Pure functions and types for the confirmation callback loop.
 * No DynamoDB — all I/O is in apps/api/src/call-assist/store.ts.
 *
 * Account: 158961537080 (nexcortiq-prod). Never reference 621957412915.
 */

import type { CallAssistCallRecord, CallAssistCallStatus, StatusHistoryEntry } from "./call-record.js";
import { CALL_ASSIST_TERMINAL_STATUSES, CASE_LIFECYCLE_UPDATED_BY } from "./call-record.js";

// ---------------------------------------------------------------------------
// Feature-flag gate
// ---------------------------------------------------------------------------

/**
 * Returns true when the confirmation-callback loop is active for this tenant.
 * When unset or false the fulfillment hook falls through to today's behavior.
 * Default: OFF (opt-in per agency; not gated by global env var).
 */
export function isCaseLifecycleEnabled(config: { confirmationLoopEnabled?: boolean } | null | undefined): boolean {
  return config?.confirmationLoopEnabled === true;
}

// ---------------------------------------------------------------------------
// Status transition validation
// ---------------------------------------------------------------------------

export type CaseLifecycleError =
  | "NOT_FOUND"
  | "TERMINAL_STATUS"
  | "ESCALATION_CAP_EXCEEDED"
  | "REOPEN_ALREADY_PENDING"
  | "CROSS_TENANT";

export type CaseLifecycleResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: CaseLifecycleError; detail: string };

/** Build a success result. */
export function lifecycleOk<T>(value: T): CaseLifecycleResult<T> {
  return { ok: true, value };
}

/** Build an error result. */
export function lifecycleErr<T>(
  error: CaseLifecycleError,
  detail: string,
): CaseLifecycleResult<T> {
  return { ok: false, error, detail };
}

/**
 * Validate that a reopen request is permitted.
 * Rules:
 *  - Record must exist (caller supplies the record after their own lookup).
 *  - Must not be in a terminal status (CLOSED/CANCELLED/DUPLICATE) — these cannot reopen.
 *    Wait, spec says CLOSED can be reopened. Only DUPLICATE and CANCELLED are truly terminal.
 *    Per prompt: "reopen a closed request" is an explicitly allowed sub-intent.
 *    Therefore terminal = CANCELLED | DUPLICATE only. CLOSED is re-openable.
 *  - Must not already be PENDING_REOPEN.
 */
export function validateReopenRequest(record: CallAssistCallRecord): CaseLifecycleResult<void> {
  if (record.status === "CANCELLED" || record.status === "DUPLICATE") {
    return lifecycleErr(
      "TERMINAL_STATUS",
      `Cannot reopen a case in ${record.status} status`,
    );
  }
  if (record.status === "PENDING_REOPEN") {
    return lifecycleErr(
      "REOPEN_ALREADY_PENDING",
      "A reopen request is already pending for this case",
    );
  }
  return lifecycleOk(undefined);
}

/**
 * Validate that an escalation request is permitted.
 * Rules:
 *  - Record must not be in a fully terminal status.
 *  - Escalation cap: at most 1 per 24 hours per case.
 */
export function validateEscalationRequest(
  record: CallAssistCallRecord,
  now = new Date(),
): CaseLifecycleResult<void> {
  if (CALL_ASSIST_TERMINAL_STATUSES.has(record.status as CallAssistCallStatus)) {
    return lifecycleErr(
      "TERMINAL_STATUS",
      `Cannot escalate a case in ${record.status} status`,
    );
  }
  if (record.lastEscalatedAt) {
    const msAgo = now.getTime() - new Date(record.lastEscalatedAt).getTime();
    const msIn24h = 24 * 60 * 60 * 1000;
    if (msAgo < msIn24h) {
      return lifecycleErr(
        "ESCALATION_CAP_EXCEEDED",
        "This case was already escalated in the last 24 hours",
      );
    }
  }
  return lifecycleOk(undefined);
}

// ---------------------------------------------------------------------------
// Status history helpers
// ---------------------------------------------------------------------------

/**
 * Build a StatusHistoryEntry to be appended. Never mutate existing history.
 */
export function buildHistoryEntry(opts: {
  status: CallAssistCallStatus;
  updatedBy: string;
  note?: string;
  at?: Date;
}): StatusHistoryEntry {
  return {
    at: (opts.at ?? new Date()).toISOString(),
    status: opts.status,
    updatedBy: opts.updatedBy,
    note: opts.note,
  };
}

/**
 * Returns the existing history with a new entry appended.
 * Never mutates the original array.
 */
export function appendHistory(
  existing: StatusHistoryEntry[] | undefined,
  entry: StatusHistoryEntry,
): StatusHistoryEntry[] {
  return [...(existing ?? []), entry];
}

// ---------------------------------------------------------------------------
// Spoken / citizen-facing status text
// ---------------------------------------------------------------------------

export type CaseStatusReadout = {
  /** Short text for voice (Polly / Nova). */
  voiceText: string;
  /** Short text for SMS. */
  smsText: string;
};

/**
 * Returns citizen-safe spoken/text description of a case status.
 * Never exposes internal field values, staff names, or system detail.
 */
export function caseStatusReadout(
  record: Pick<
    CallAssistCallRecord,
    "status" | "confirmationNumber" | "incidentType" | "department" | "slaMinutes"
  >,
): CaseStatusReadout {
  const n = record.confirmationNumber;
  const dept = record.department ?? "the right team";

  switch (record.status) {
    case "OPEN":
      return {
        voiceText: `Your report ${n} has been received and is waiting to be assigned. ${dept} will review it soon.`,
        smsText: `Report ${n}: Received — awaiting assignment by ${dept}.`,
      };
    case "ROUTED":
      return {
        voiceText: `Your report ${n} has been sent to ${dept} for action.`,
        smsText: `Report ${n}: Sent to ${dept}.`,
      };
    case "ACKNOWLEDGED":
      return {
        voiceText: `Your report ${n} has been acknowledged by ${dept}. Someone is aware of it.`,
        smsText: `Report ${n}: Acknowledged by ${dept}.`,
      };
    case "IN_PROGRESS":
      return {
        voiceText: `Your report ${n} is currently being worked on by ${dept}.`,
        smsText: `Report ${n}: In progress with ${dept}.`,
      };
    case "CLOSED":
      return {
        voiceText: `Your report ${n} has been closed by ${dept}. If the problem has returned, I can note a reopen request.`,
        smsText: `Report ${n}: Closed. Reply REOPEN ${n} if the issue returned.`,
      };
    case "ESCALATED":
      return {
        voiceText: `Your report ${n} has been escalated for priority review. ${dept} has been notified.`,
        smsText: `Report ${n}: Escalated for priority review.`,
      };
    case "CANCELLED":
      return {
        voiceText: `Your report ${n} was cancelled. If you need to report this issue again, please describe it and we will start a new request.`,
        smsText: `Report ${n}: Cancelled. Text us to file a new report.`,
      };
    case "DUPLICATE":
      return {
        voiceText: `Your report ${n} was merged with an existing report covering the same issue. The combined report is being handled.`,
        smsText: `Report ${n}: Merged with existing report.`,
      };
    case "AWAITING_INFORMATION":
      return {
        voiceText: `Your report ${n} is awaiting more information before ${dept} can act. We may contact you at the number you provided.`,
        smsText: `Report ${n}: Awaiting information — ${dept} may contact you.`,
      };
    case "PENDING_REOPEN": {
      const slaNote = record.slaMinutes
        ? ` within about ${Math.ceil(record.slaMinutes / 60)} hour${record.slaMinutes > 90 ? "s" : ""}`
        : "";
      return {
        voiceText: `Your reopen request for report ${n} has been noted. ${dept} will review it${slaNote}.`,
        smsText: `Report ${n}: Reopen requested. ${dept} will review${slaNote}.`,
      };
    }
    default: {
      // TypeScript exhaustive fallback
      const s = (record as { status: string }).status;
      return {
        voiceText: `Your report ${n} is currently ${s.toLowerCase().replace(/_/g, " ")}. I'll let ${dept} know you called.`,
        smsText: `Report ${n}: ${s}.`,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// ANI / confirmation ambiguity helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the confirmation number looks well-formed.
 * Pattern: two uppercase letters, four digits, four safe characters.
 * Lenient — accepts any prefix length 1–6 so agency prefixes vary.
 */
export function isValidConfirmationFormat(raw: string): boolean {
  // e.g. KC-1001-7M4R or RC-1001-ABCD
  return /^[A-Z]{1,6}-\d{4}-[ACDEFGHJKMNPQRTUVWXYZ234679]{4}$/i.test(raw.trim());
}

/**
 * When the caller provides a partial match (last 4 characters) find the most
 * likely record from a list of recent records for this caller's ANI.
 * Returns null if none or multiple match.
 */
export function matchPartialConfirmation(
  partial: string,
  candidates: Pick<CallAssistCallRecord, "confirmationNumber">[],
): string | null {
  const suffix = partial.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (suffix.length < 4) return null;
  const matches = candidates.filter((c) =>
    c.confirmationNumber.replace(/[^A-Z0-9]/gi, "").toUpperCase().endsWith(suffix),
  );
  return matches.length === 1 ? (matches[0]?.confirmationNumber ?? null) : null;
}

// ---------------------------------------------------------------------------
// Status-transition SMS copy
// ---------------------------------------------------------------------------

/**
 * Returns the outbound SMS text to send when a case status changes.
 * Only called when `threeOneOneStatusSmsEnabled = true` on the tenant config.
 */
export function statusTransitionSms(opts: {
  confirmationNumber: string;
  newStatus: CallAssistCallStatus;
  department?: string;
  agencyShortName?: string;
}): string {
  const n = opts.confirmationNumber;
  const dept = opts.department ?? "the city";
  const org = opts.agencyShortName ?? "City Services";
  const footer = "Reply STOP to unsubscribe. Emergencies: call 911.";

  switch (opts.newStatus) {
    case "ROUTED":
      return `${org}: Your report ${n} was sent to ${dept} for review. ${footer}`;
    case "ACKNOWLEDGED":
      return `${org}: ${dept} acknowledged your report ${n}. ${footer}`;
    case "IN_PROGRESS":
      return `${org}: ${dept} is working on your report ${n}. ${footer}`;
    case "CLOSED":
      return `${org}: Your report ${n} was closed by ${dept}. Text CHECK ${n} to verify or REOPEN ${n} if the issue returned. ${footer}`;
    case "ESCALATED":
      return `${org}: Your report ${n} was escalated for priority review. ${footer}`;
    case "PENDING_REOPEN":
      return `${org}: Reopen request noted for report ${n}. ${dept} will review. ${footer}`;
    default:
      return `${org}: Update on your report ${n}: status is now ${opts.newStatus.toLowerCase().replace(/_/g, " ")}. ${footer}`;
  }
}

// ---------------------------------------------------------------------------
// Reopen/escalate Nova Sonic voice copy
// ---------------------------------------------------------------------------

/** Returns what Nova should say after successfully noting a reopen request. */
export function reopenAcknowledgementVoice(confirmationNumber: string): string {
  return (
    `I've noted your reopen request for report ${confirmationNumber}. ` +
    `The team will review the status and follow up. ` +
    `Is there anything else I can help you with?`
  );
}

/** Returns what Nova should say after successfully noting an escalation. */
export function escalationAcknowledgementVoice(confirmationNumber: string): string {
  return (
    `I've escalated your report ${confirmationNumber} for priority review. ` +
    `The supervisor team has been notified. ` +
    `Is there anything else I can help you with today?`
  );
}

/** Returns what Nova should say when the escalation cap is hit. */
export function escalationCapVoice(confirmationNumber: string): string {
  return (
    `Your report ${confirmationNumber} was already escalated recently. ` +
    `Escalations are limited to once per day to give the team time to respond. ` +
    `I've noted that you called again. Is there anything else I can do?`
  );
}

/** Returns what Nova should say when a case cannot be found by confirmation number. */
export function caseNotFoundVoice(partial: string): string {
  return (
    `I wasn't able to find a report with that number, ${partial}. ` +
    `Make sure you have the full confirmation from your original report. ` +
    `It looks like two letters, then four digits, then four more characters. ` +
    `Would you like to try again, or is there something else I can help with?`
  );
}

/** Returns what Nova should say when ANI matches a recent case but number wasn't provided. */
export function aniRecognitionGreeting(confirmationNumber: string): string {
  return (
    `I see you may have an open report with us — confirmation ${confirmationNumber}. ` +
    `Would you like a status update on that report, or is this about something new?`
  );
}
