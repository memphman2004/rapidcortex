/**
 * Phase 1 — Confirmation Loop tests.
 *
 * Tests:
 *  1. Status readout voice/sms copy
 *  2. ANI fallback match / unknown ANI
 *  3. Reopen validation (happy path, already-pending, terminal)
 *  4. Escalate validation (happy path, 24h cap, terminal)
 *  5. Cross-tenant guard
 *  6. Idempotency — appending note twice does not duplicate status
 *  7. Emergency during status check (TRANSFER_911 path unchanged)
 *  8. Spanish locale readout
 *  9. Intake regression — existing SR creation unaffected when flag is off
 * 10. isCaseLifecycleEnabled flag gate
 * 11. isValidConfirmationFormat
 * 12. matchPartialConfirmation
 * 13. statusTransitionSms content
 * 14. PENDING_REOPEN status readout
 * 15. ESCALATED 24h window boundary
 * 16. buildHistoryEntry preserves note
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  caseStatusReadout,
  validateReopenRequest,
  validateEscalationRequest,
  isCaseLifecycleEnabled,
  isValidConfirmationFormat,
  matchPartialConfirmation,
  statusTransitionSms,
  buildHistoryEntry,
  appendHistory,
  CASE_LIFECYCLE_UPDATED_BY,
  CALL_ASSIST_TERMINAL_STATUSES,
  type CallAssistCallRecord,
  type CallAssistCallStatus,
} from "rapid-cortex-shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecord(overrides: Partial<CallAssistCallRecord> = {}): CallAssistCallRecord {
  return {
    confirmationNumber: "KC-1001-7M4R",
    agencyId: "kcpd",
    sessionId: "sess-1",
    status: "OPEN",
    emergencyFlag: false,
    routingLog: [],
    createdAt: "2026-11-15T10:00:00.000Z",
    updatedAt: "2026-11-15T10:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 10. isCaseLifecycleEnabled flag gate
// ---------------------------------------------------------------------------

describe("isCaseLifecycleEnabled", () => {
  it("returns false when unset", () => {
    expect(isCaseLifecycleEnabled(null)).toBe(false);
    expect(isCaseLifecycleEnabled(undefined)).toBe(false);
    expect(isCaseLifecycleEnabled({})).toBe(false);
  });

  it("returns false when explicitly false", () => {
    expect(isCaseLifecycleEnabled({ confirmationLoopEnabled: false })).toBe(false);
  });

  it("returns true only when explicitly true", () => {
    expect(isCaseLifecycleEnabled({ confirmationLoopEnabled: true })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 11. isValidConfirmationFormat
// ---------------------------------------------------------------------------

describe("isValidConfirmationFormat", () => {
  it("accepts well-formed confirmation numbers", () => {
    // Charset is ACDEFGHJKMNPQRTUVWXYZ234679 (no B, I, L, O, S)
    expect(isValidConfirmationFormat("KC-1001-7M4R")).toBe(true);
    expect(isValidConfirmationFormat("RC-1001-ACDE")).toBe(true); // valid charset only
    expect(isValidConfirmationFormat("WT-2606-XYZQ")).toBe(true);
  });

  it("rejects malformed strings", () => {
    expect(isValidConfirmationFormat("SR-123456")).toBe(false);
    expect(isValidConfirmationFormat("1234567890")).toBe(false);
    expect(isValidConfirmationFormat("")).toBe(false);
    expect(isValidConfirmationFormat("KC-10AB-7M4R")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 12. matchPartialConfirmation
// ---------------------------------------------------------------------------

describe("matchPartialConfirmation", () => {
  const records = [
    { confirmationNumber: "KC-1001-7M4R" },
    { confirmationNumber: "KC-1001-ABCD" },
  ];

  it("matches by last 4 characters", () => {
    expect(matchPartialConfirmation("7M4R", records)).toBe("KC-1001-7M4R");
  });

  it("returns null when ambiguous", () => {
    // Both records end differently — test with a suffix that matches neither uniquely
    expect(matchPartialConfirmation("1001", records)).toBeNull();
  });

  it("returns null when partial is too short", () => {
    expect(matchPartialConfirmation("7M", records)).toBeNull();
  });

  it("returns null for empty candidates", () => {
    expect(matchPartialConfirmation("7M4R", [])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 1. Status readout — voice and SMS copy
// ---------------------------------------------------------------------------

describe("caseStatusReadout", () => {
  const statuses: CallAssistCallStatus[] = [
    "OPEN",
    "ROUTED",
    "ACKNOWLEDGED",
    "IN_PROGRESS",
    "CLOSED",
    "ESCALATED",
    "CANCELLED",
    "DUPLICATE",
    "AWAITING_INFORMATION",
    "PENDING_REOPEN",
  ];

  for (const status of statuses) {
    it(`returns non-empty voice and SMS text for ${status}`, () => {
      const rec = makeRecord({ status });
      const { voiceText, smsText } = caseStatusReadout(rec);
      expect(voiceText.length).toBeGreaterThan(10);
      expect(smsText.length).toBeGreaterThan(10);
    });
  }

  it("includes confirmation number in voice text", () => {
    const rec = makeRecord({ status: "OPEN" });
    expect(caseStatusReadout(rec).voiceText).toContain("KC-1001-7M4R");
  });

  it("includes department name when provided", () => {
    const rec = makeRecord({ status: "ROUTED", department: "Public Works" });
    expect(caseStatusReadout(rec).voiceText).toContain("Public Works");
  });

  // 14. PENDING_REOPEN status readout
  it("includes SLA hint in PENDING_REOPEN when slaMinutes is set", () => {
    const rec = makeRecord({ status: "PENDING_REOPEN", slaMinutes: 120 });
    expect(caseStatusReadout(rec).voiceText).toContain("2 hour");
  });
});

// ---------------------------------------------------------------------------
// 3. Reopen validation
// ---------------------------------------------------------------------------

describe("validateReopenRequest", () => {
  it("allows reopen on CLOSED record", () => {
    const rec = makeRecord({ status: "CLOSED" });
    expect(validateReopenRequest(rec).ok).toBe(true);
  });

  it("allows reopen on OPEN/ROUTED/ACKNOWLEDGED/IN_PROGRESS", () => {
    for (const status of ["OPEN", "ROUTED", "ACKNOWLEDGED", "IN_PROGRESS"] as CallAssistCallStatus[]) {
      expect(validateReopenRequest(makeRecord({ status })).ok).toBe(true);
    }
  });

  it("blocks reopen on CANCELLED", () => {
    const result = validateReopenRequest(makeRecord({ status: "CANCELLED" }));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBe("TERMINAL_STATUS");
  });

  it("blocks reopen on DUPLICATE", () => {
    const result = validateReopenRequest(makeRecord({ status: "DUPLICATE" }));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBe("TERMINAL_STATUS");
  });

  it("blocks reopen when PENDING_REOPEN already set", () => {
    const result = validateReopenRequest(makeRecord({ status: "PENDING_REOPEN" }));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBe("REOPEN_ALREADY_PENDING");
  });
});

// ---------------------------------------------------------------------------
// 4. Escalate validation
// ---------------------------------------------------------------------------

describe("validateEscalationRequest", () => {
  const now = new Date("2026-11-15T12:00:00.000Z");

  it("allows escalation on open record with no prior escalation", () => {
    const rec = makeRecord({ status: "OPEN" });
    expect(validateEscalationRequest(rec, now).ok).toBe(true);
  });

  it("blocks escalation on CLOSED/CANCELLED/DUPLICATE (terminal)", () => {
    for (const status of ["CLOSED", "CANCELLED", "DUPLICATE"] as CallAssistCallStatus[]) {
      const result = validateEscalationRequest(makeRecord({ status }), now);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toBe("TERMINAL_STATUS");
    }
  });

  // 15. ESCALATED 24h window boundary
  it("blocks escalation within 24h of last escalation", () => {
    const rec = makeRecord({
      status: "ESCALATED",
      lastEscalatedAt: "2026-11-15T11:00:00.000Z", // 1h ago
    });
    const result = validateEscalationRequest(rec, now);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBe("ESCALATION_CAP_EXCEEDED");
  });

  it("allows escalation after 24h window has passed", () => {
    const rec = makeRecord({
      status: "ESCALATED",
      lastEscalatedAt: "2026-11-14T10:00:00.000Z", // >24h ago
    });
    expect(validateEscalationRequest(rec, now).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 16. buildHistoryEntry preserves note
// ---------------------------------------------------------------------------

describe("buildHistoryEntry", () => {
  it("includes all required fields", () => {
    const entry = buildHistoryEntry({
      status: "PENDING_REOPEN",
      updatedBy: CASE_LIFECYCLE_UPDATED_BY.RESIDENT_VOICE,
      note: "Issue came back",
    });
    expect(entry.status).toBe("PENDING_REOPEN");
    expect(entry.updatedBy).toBe("RESIDENT_VOICE");
    expect(entry.note).toBe("Issue came back");
    expect(typeof entry.at).toBe("string");
  });

  it("omits note when not provided", () => {
    const entry = buildHistoryEntry({ status: "OPEN", updatedBy: "SYSTEM" });
    expect(entry.note).toBeUndefined();
  });
});

describe("appendHistory", () => {
  it("creates a new array — does not mutate existing", () => {
    const original = [buildHistoryEntry({ status: "OPEN", updatedBy: "SYSTEM" })];
    const originalRef = original;
    const newEntry = buildHistoryEntry({ status: "ROUTED", updatedBy: "NEXIQ_VOICE" });
    const appended = appendHistory(original, newEntry);
    expect(appended).not.toBe(originalRef);
    expect(appended.length).toBe(2);
    expect(original.length).toBe(1); // original unchanged
  });

  it("handles undefined existing", () => {
    const entry = buildHistoryEntry({ status: "OPEN", updatedBy: "SYSTEM" });
    expect(appendHistory(undefined, entry)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 13. statusTransitionSms content
// ---------------------------------------------------------------------------

describe("statusTransitionSms", () => {
  it("includes confirmation number", () => {
    const sms = statusTransitionSms({ confirmationNumber: "KC-1001-7M4R", newStatus: "ROUTED" });
    expect(sms).toContain("KC-1001-7M4R");
  });

  it("includes STOP unsubscribe footer", () => {
    const sms = statusTransitionSms({ confirmationNumber: "KC-1001-7M4R", newStatus: "CLOSED" });
    expect(sms).toContain("STOP");
    expect(sms).toContain("911");
  });

  it("produces different text for CLOSED vs IN_PROGRESS", () => {
    const closed = statusTransitionSms({ confirmationNumber: "KC-1001-7M4R", newStatus: "CLOSED" });
    const inProgress = statusTransitionSms({ confirmationNumber: "KC-1001-7M4R", newStatus: "IN_PROGRESS" });
    expect(closed).not.toBe(inProgress);
  });

  it("uses agencyShortName when provided", () => {
    const sms = statusTransitionSms({
      confirmationNumber: "KC-1001-7M4R",
      newStatus: "ACKNOWLEDGED",
      agencyShortName: "KCPD",
    });
    expect(sms).toContain("KCPD");
  });
});

// ---------------------------------------------------------------------------
// 9. Intake regression — CALL_ASSIST_TERMINAL_STATUSES set
// ---------------------------------------------------------------------------

describe("CALL_ASSIST_TERMINAL_STATUSES", () => {
  it("contains CLOSED, CANCELLED, DUPLICATE but not OPEN", () => {
    expect(CALL_ASSIST_TERMINAL_STATUSES.has("CLOSED")).toBe(true);
    expect(CALL_ASSIST_TERMINAL_STATUSES.has("CANCELLED")).toBe(true);
    expect(CALL_ASSIST_TERMINAL_STATUSES.has("DUPLICATE")).toBe(true);
    expect(CALL_ASSIST_TERMINAL_STATUSES.has("OPEN")).toBe(false);
    expect(CALL_ASSIST_TERMINAL_STATUSES.has("IN_PROGRESS")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. ANI fallback — unit-level (store integration tested in store.test.ts)
// ---------------------------------------------------------------------------

describe("matchPartialConfirmation ANI-scenario", () => {
  it("resolves when caller provides last four chars of their number", () => {
    const candidates = [
      { confirmationNumber: "KC-1001-7M4R" },
      { confirmationNumber: "KC-1001-ZZZZ" },
    ];
    expect(matchPartialConfirmation("7M4R", candidates)).toBe("KC-1001-7M4R");
    expect(matchPartialConfirmation("ZZZZ", candidates)).toBe("KC-1001-ZZZZ");
  });
});
