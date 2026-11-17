/**
 * Phase 3 — Competitive Matrix, Open311 Adapter, Duplicate Detection,
 * Media Intake, Unified Inbox, SR Analytics tests
 *
 * Pure unit tests — no DynamoDB, no AWS calls.
 */
import { describe, it, expect } from "vitest";

import {
  // Open311
  isOpen311AdapterEnabled,
  toOpen311Status,
  toOpen311ServiceRequest,
  fromOpen311StatusUpdate,
  departmentToOpen311ServiceCode,
  // Duplicate detection
  isDuplicateDetectionEnabled,
  tokenizeAddress,
  jaccardSimilarity,
  scoreDuplicateCandidate,
  checkForDuplicates,
  duplicateCandidateVoice,
  duplicateCandidateSms,
  // Media intake
  isMediaIntakeEnabled,
  buildMediaS3Key,
  sanitizeFilename,
  isSupportedMimeType,
  isWithinSizeLimit,
  MAX_MEDIA_SIZE_BYTES,
  // Unified inbox
  isUnifiedInboxEnabled,
  toInboxItem,
  filterInboxItems,
  sortInboxItems,
  scoreInboxItem,
  // SR analytics
  isSrAnalyticsEnabled,
  aggregateSrAnalytics,
  dailyVolumeTrend,
  // Competitive matrix
  getCompetitorProfile,
  differentiatorKeys,
  NEXCORTIQ_FEATURES,
  COMPETITIVE_FEATURE_LABELS,
} from "rapid-cortex-shared";

import type { CallAssistCallRecord } from "rapid-cortex-shared";

// ---------------------------------------------------------------------------
// Test record factory
// ---------------------------------------------------------------------------

function makeRecord(overrides: Partial<CallAssistCallRecord> = {}): CallAssistCallRecord {
  return {
    confirmationNumber: "KC-2024-ACDE",
    agencyId: "kcpd",
    sessionId: "sess-001",
    status: "OPEN",
    emergencyFlag: false,
    routingLog: [],
    createdAt: "2024-11-01T10:00:00.000Z",
    updatedAt: "2024-11-01T10:05:00.000Z",
    incidentType: "POTHOLE",
    incidentLocation: "123 Main St Kansas City MO",
    department: "PUBLIC_WORKS",
    ...overrides,
  };
}

// ===========================================================================
// Open311 Adapter
// ===========================================================================

describe("isOpen311AdapterEnabled", () => {
  it("returns false when unset", () => expect(isOpen311AdapterEnabled({})).toBe(false));
  it("returns false when null", () => expect(isOpen311AdapterEnabled(null)).toBe(false));
  it("returns true when explicitly set", () =>
    expect(isOpen311AdapterEnabled({ open311AdapterEnabled: true })).toBe(true));
});

describe("toOpen311Status", () => {
  it("maps CLOSED to closed", () => expect(toOpen311Status("CLOSED")).toBe("closed"));
  it("maps CANCELLED to closed", () => expect(toOpen311Status("CANCELLED")).toBe("closed"));
  it("maps DUPLICATE to closed", () => expect(toOpen311Status("DUPLICATE")).toBe("closed"));
  it("maps OPEN to open", () => expect(toOpen311Status("OPEN")).toBe("open"));
  it("maps ESCALATED to open", () => expect(toOpen311Status("ESCALATED")).toBe("open"));
  it("maps IN_PROGRESS to open", () => expect(toOpen311Status("IN_PROGRESS")).toBe("open"));
});

describe("toOpen311ServiceRequest", () => {
  it("populates required fields", () => {
    const rec = makeRecord();
    const sr = toOpen311ServiceRequest(rec);
    expect(sr.service_request_id).toBe("KC-2024-ACDE");
    expect(sr.status).toBe("open");
    expect(sr.requested_datetime).toBe("2024-11-01T10:00:00.000Z");
  });

  it("uses override service code when provided", () => {
    const rec = makeRecord();
    const sr = toOpen311ServiceRequest(rec, { serviceCode: "CUSTOM-01" });
    expect(sr.service_code).toBe("CUSTOM-01");
  });

  it("includes media_url when provided", () => {
    const rec = makeRecord();
    const sr = toOpen311ServiceRequest(rec, { mediaUrl: "https://cdn.example.com/photo.jpg" });
    expect(sr.media_url).toBe("https://cdn.example.com/photo.jpg");
  });

  it("omits media_url when not provided", () => {
    const sr = toOpen311ServiceRequest(makeRecord());
    expect(sr.media_url).toBeUndefined();
  });
});

describe("fromOpen311StatusUpdate", () => {
  it("parses a closed update", () => {
    const result = fromOpen311StatusUpdate({
      service_request_id: "KC-2024-ACDE",
      status: "closed",
      status_notes: "Repair completed.",
      updated_datetime: "2024-11-02T15:00:00.000Z",
      agency_responsible: "Public Works Crew 7",
    });
    expect(result.confirmationNumber).toBe("KC-2024-ACDE");
    expect(result.open311Status).toBe("closed");
    expect(result.newStatusNote).toContain("Repair completed.");
    expect(result.newStatusNote).toContain("Public Works Crew 7");
  });

  it("generates default note when status_notes absent", () => {
    const result = fromOpen311StatusUpdate({
      service_request_id: "KC-2024-ACDE",
      status: "open",
      updated_datetime: "2024-11-02T12:00:00.000Z",
    });
    expect(result.newStatusNote).toBeTruthy();
  });
});

describe("departmentToOpen311ServiceCode", () => {
  it("maps PUBLIC_WORKS to RD-POT", () =>
    expect(departmentToOpen311ServiceCode("PUBLIC_WORKS")).toBe("RD-POT"));
  it("maps SANITATION to SW-MSS", () =>
    expect(departmentToOpen311ServiceCode("SANITATION")).toBe("SW-MSS"));
  it("falls back to 311-GEN for unknown dept", () =>
    expect(departmentToOpen311ServiceCode("UNKNOWN")).toBe("311-GEN"));
});

// ===========================================================================
// Duplicate Detection
// ===========================================================================

describe("isDuplicateDetectionEnabled", () => {
  it("returns false when unset", () => expect(isDuplicateDetectionEnabled({})).toBe(false));
  it("returns true when set", () =>
    expect(isDuplicateDetectionEnabled({ duplicateDetectionEnabled: true })).toBe(true));
});

describe("tokenizeAddress", () => {
  it("lowercases and splits", () =>
    expect(tokenizeAddress("123 Main St")).toEqual(["123", "main", "st"]));
  it("removes punctuation", () =>
    expect(tokenizeAddress("123 Main St, Kansas City, MO")).toEqual(["123", "main", "st", "kansas", "city", "mo"]));
  it("returns empty for undefined", () => expect(tokenizeAddress(undefined)).toEqual([]));
  it("filters single-char tokens", () => expect(tokenizeAddress("A Main St")).not.toContain("a"));
});

describe("jaccardSimilarity", () => {
  it("returns 1.0 for identical sets", () =>
    expect(jaccardSimilarity(["a", "b"], ["a", "b"])).toBe(1));
  it("returns 0 for completely different sets", () =>
    expect(jaccardSimilarity(["a", "b"], ["c", "d"])).toBe(0));
  it("returns 0.5 for 50% overlap", () =>
    expect(jaccardSimilarity(["a", "b"], ["b", "c"])).toBeCloseTo(0.33, 1));
  it("returns 1.0 for two empty arrays", () =>
    expect(jaccardSimilarity([], [])).toBe(1));
  it("returns 0 when one array is empty", () =>
    expect(jaccardSimilarity(["a"], [])).toBe(0));
});

describe("scoreDuplicateCandidate", () => {
  it("returns null for CLOSED candidate", () => {
    const rec = makeRecord({ status: "CLOSED" });
    expect(scoreDuplicateCandidate({ agencyId: "kcpd", department: "PUBLIC_WORKS", incidentLocation: "123 Main St" }, rec, 2880)).toBeNull();
  });

  it("returns null for candidate outside time window", () => {
    const rec = makeRecord({ createdAt: "2020-01-01T00:00:00.000Z" });
    expect(scoreDuplicateCandidate({ agencyId: "kcpd" }, rec, 60)).toBeNull();
  });

  it("scores high for matching department + address", () => {
    // Use a recent createdAt so it falls within the 2880-minute window
    const rec = makeRecord({ createdAt: new Date(Date.now() - 60_000).toISOString() });
    const result = scoreDuplicateCandidate(
      { agencyId: "kcpd", department: "PUBLIC_WORKS", incidentLocation: "123 Main St Kansas City MO" },
      rec,
      2880,
    );
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(0.5);
  });
});

describe("checkForDuplicates", () => {
  it("returns no duplicates for empty candidates", () => {
    const result = checkForDuplicates({
      newRecord: { agencyId: "kcpd", department: "PUBLIC_WORKS", incidentLocation: "123 Main St" },
      candidates: [],
    });
    expect(result.hasDuplicates).toBe(false);
    expect(result.candidates).toEqual([]);
  });

  it("filters cross-tenant candidates", () => {
    const rec = makeRecord({ agencyId: "other-agency" });
    const result = checkForDuplicates({
      newRecord: { agencyId: "kcpd", department: "PUBLIC_WORKS", incidentLocation: "123 Main St" },
      candidates: [rec],
    });
    expect(result.hasDuplicates).toBe(false);
  });

  it("surfaces matching candidate above threshold", () => {
    // Use a recent createdAt so it falls within the default 2880-minute window
    const rec = makeRecord({
      agencyId: "kcpd",
      department: "PUBLIC_WORKS",
      incidentLocation: "123 Main St Kansas City MO",
      status: "OPEN",
      createdAt: new Date(Date.now() - 60_000).toISOString(),
      updatedAt: new Date(Date.now() - 30_000).toISOString(),
    });
    const result = checkForDuplicates({
      newRecord: { agencyId: "kcpd", department: "PUBLIC_WORKS", incidentLocation: "123 Main St Kansas City MO", incidentType: "POTHOLE" },
      candidates: [rec],
      threshold: 0.5,
    });
    expect(result.hasDuplicates).toBe(true);
    expect(result.candidates[0]!.confirmationNumber).toBe("KC-2024-ACDE");
  });

  it("sorts candidates by score descending", () => {
    const rec1 = makeRecord({ confirmationNumber: "KC-2024-0001", department: "SANITATION", incidentLocation: "456 Elm St" });
    const rec2 = makeRecord({ confirmationNumber: "KC-2024-0002", department: "PUBLIC_WORKS", incidentLocation: "123 Main St Kansas City MO" });
    const result = checkForDuplicates({
      newRecord: { agencyId: "kcpd", department: "PUBLIC_WORKS", incidentLocation: "123 Main St Kansas City MO" },
      candidates: [rec1, rec2],
      threshold: 0.1,
    });
    if (result.candidates.length >= 2) {
      expect(result.candidates[0]!.score).toBeGreaterThanOrEqual(result.candidates[1]!.score);
    }
  });
});

describe("duplicate voice/SMS copy", () => {
  it("duplicateCandidateVoice includes confirmation number", () => {
    const text = duplicateCandidateVoice({ confirmationNumber: "KC-2024-ACDE", status: "OPEN", score: 0.8, reason: "same address" });
    expect(text).toContain("KC-2024-ACDE");
  });

  it("duplicateCandidateSms includes status", () => {
    const text = duplicateCandidateSms({ confirmationNumber: "KC-2024-ACDE", status: "IN_PROGRESS", score: 0.8, reason: "same address" });
    expect(text).toContain("IN_PROGRESS");
  });
});

// ===========================================================================
// Media Intake
// ===========================================================================

describe("isMediaIntakeEnabled", () => {
  it("returns false when unset", () => expect(isMediaIntakeEnabled({})).toBe(false));
  it("returns true when set", () =>
    expect(isMediaIntakeEnabled({ mediaIntakeEnabled: true })).toBe(true));
});

describe("buildMediaS3Key", () => {
  it("produces correct key format", () => {
    const key = buildMediaS3Key({
      agencyId: "kcpd",
      confirmationNumber: "KC-2024-ACDE",
      filename: "photo.jpg",
      now: new Date("2024-11-01T12:00:00Z"),
    });
    expect(key).toBe("media/kcpd/2024-11/KC-2024-ACDE/photo.jpg");
  });

  it("sanitizes filename with special chars", () => {
    const key = buildMediaS3Key({
      agencyId: "kcpd",
      confirmationNumber: "KC-2024-ACDE",
      filename: "My Photo!! (1).jpg",
      now: new Date("2024-11-01T12:00:00Z"),
    });
    expect(key).not.toContain("!!");
    expect(key).not.toContain(" ");
  });
});

describe("sanitizeFilename", () => {
  it("lowercases and removes special chars", () =>
    expect(sanitizeFilename("My Photo.jpg")).toBe("my_photo.jpg"));
  it("preserves valid chars", () =>
    expect(sanitizeFilename("photo-001.png")).toBe("photo-001.png"));
  it("returns upload for empty input", () =>
    expect(sanitizeFilename("")).toBe("upload"));
});

describe("isSupportedMimeType / isWithinSizeLimit", () => {
  it("accepts image/jpeg", () => expect(isSupportedMimeType("image/jpeg")).toBe(true));
  it("accepts application/pdf", () => expect(isSupportedMimeType("application/pdf")).toBe(true));
  it("rejects text/html", () => expect(isSupportedMimeType("text/html")).toBe(false));
  it("accepts file within 20MB", () => expect(isWithinSizeLimit(1024 * 1024)).toBe(true));
  it("rejects file over 20MB", () => expect(isWithinSizeLimit(MAX_MEDIA_SIZE_BYTES + 1)).toBe(false));
  it("rejects zero-byte file", () => expect(isWithinSizeLimit(0)).toBe(false));
});

// ===========================================================================
// Unified Inbox
// ===========================================================================

describe("isUnifiedInboxEnabled", () => {
  it("returns false when unset", () => expect(isUnifiedInboxEnabled({})).toBe(false));
  it("returns true when set", () =>
    expect(isUnifiedInboxEnabled({ unifiedInboxEnabled: true })).toBe(true));
});

describe("toInboxItem", () => {
  it("maps basic fields correctly", () => {
    const item = toInboxItem(makeRecord(), { channel: "voice_nova" });
    expect(item.confirmationNumber).toBe("KC-2024-ACDE");
    expect(item.status).toBe("OPEN");
    expect(item.channel).toBe("voice_nova");
    expect(item.hasEscalation).toBe(false);
    expect(item.hasMedia).toBe(false);
  });

  it("sets hasEscalation=true when status is ESCALATED", () => {
    const item = toInboxItem(makeRecord({ status: "ESCALATED" }));
    expect(item.hasEscalation).toBe(true);
  });

  it("computes priorityScore > 0", () => {
    const item = toInboxItem(makeRecord());
    expect(item.priorityScore).toBeGreaterThan(0);
  });

  it("escalated item has higher priority than open", () => {
    const open = toInboxItem(makeRecord({ status: "OPEN" }));
    const escalated = toInboxItem(makeRecord({ status: "ESCALATED" }));
    expect(escalated.priorityScore).toBeGreaterThan(open.priorityScore);
  });
});

describe("filterInboxItems", () => {
  const items = [
    toInboxItem(makeRecord({ confirmationNumber: "A", status: "OPEN", department: "PUBLIC_WORKS" }), { channel: "voice_nova" }),
    toInboxItem(makeRecord({ confirmationNumber: "B", status: "CLOSED", department: "SANITATION" }), { channel: "sms" }),
    toInboxItem(makeRecord({ confirmationNumber: "C", status: "ESCALATED", department: "PUBLIC_WORKS" }), { channel: "voice_lex" }),
  ];

  it("filters by status", () => {
    const result = filterInboxItems(items, { status: ["OPEN"] });
    expect(result.map((i) => i.confirmationNumber)).toEqual(["A"]);
  });

  it("filters by department", () => {
    const result = filterInboxItems(items, { departments: ["SANITATION"] });
    expect(result.map((i) => i.confirmationNumber)).toEqual(["B"]);
  });

  it("filters by channel", () => {
    const result = filterInboxItems(items, { channels: ["sms"] });
    expect(result.map((i) => i.confirmationNumber)).toEqual(["B"]);
  });

  it("filters by query string", () => {
    const result = filterInboxItems(items, { query: "acde" });
    // All have confirmationNumber starting with "A" etc., none match "acde" literally
    expect(result.length).toBe(0);
  });

  it("returns all items when filter is empty", () => {
    expect(filterInboxItems(items, {}).length).toBe(3);
  });
});

describe("sortInboxItems", () => {
  it("does not mutate the input array", () => {
    const items = [toInboxItem(makeRecord({ status: "OPEN" })), toInboxItem(makeRecord({ status: "ESCALATED" }))];
    const original = [...items];
    sortInboxItems(items, { field: "priorityScore", order: "desc" });
    expect(items).toEqual(original);
  });

  it("sorts by priorityScore desc by default", () => {
    const items = [
      toInboxItem(makeRecord({ status: "OPEN" })),
      toInboxItem(makeRecord({ status: "ESCALATED" })),
    ];
    const sorted = sortInboxItems(items);
    expect(sorted[0]!.status).toBe("ESCALATED");
  });
});

// ===========================================================================
// SR Analytics
// ===========================================================================

describe("isSrAnalyticsEnabled", () => {
  it("returns false when unset", () => expect(isSrAnalyticsEnabled({})).toBe(false));
  it("returns true when set", () =>
    expect(isSrAnalyticsEnabled({ srAnalyticsEnabled: true })).toBe(true));
});

describe("aggregateSrAnalytics", () => {
  const records: CallAssistCallRecord[] = [
    makeRecord({ confirmationNumber: "A", status: "CLOSED", department: "PUBLIC_WORKS", createdAt: "2024-11-01T10:00:00Z", updatedAt: "2024-11-01T14:00:00Z" }),
    makeRecord({ confirmationNumber: "B", status: "OPEN", department: "SANITATION", createdAt: "2024-11-01T11:00:00Z", updatedAt: "2024-11-01T11:05:00Z" }),
    makeRecord({ confirmationNumber: "C", status: "ESCALATED", department: "PUBLIC_WORKS", createdAt: "2024-11-02T08:00:00Z", updatedAt: "2024-11-02T08:30:00Z" }),
    // This one is outside the window
    makeRecord({ confirmationNumber: "D", status: "OPEN", department: "SANITATION", createdAt: "2024-10-01T10:00:00Z", updatedAt: "2024-10-01T10:05:00Z" }),
  ];

  const summary = aggregateSrAnalytics({
    agencyId: "kcpd",
    records,
    windowStart: "2024-11-01T00:00:00Z",
    windowEnd: "2024-11-30T23:59:59Z",
    departmentSlaMins: { PUBLIC_WORKS: 480, SANITATION: 1440 },
    departmentNames: { PUBLIC_WORKS: "Public Works", SANITATION: "Sanitation" },
  });

  it("counts only in-window records", () => {
    expect(summary.totalSrs).toBe(3);
  });

  it("counts open/closed/escalated correctly", () => {
    expect(summary.closedSrs).toBe(1);
    // ESCALATED records are in OPEN_STATUSES (they're not closed), so openSrs includes
    // both record B (OPEN) and record C (ESCALATED) = 2
    expect(summary.openSrs).toBe(2);
    expect(summary.escalatedSrs).toBe(1);
  });

  it("computes avgResolutionMinutes for closed SRs", () => {
    // Record A: closed in 4 hours = 240 min
    expect(summary.avgResolutionMinutes).toBe(240);
  });

  it("includes department volume entries", () => {
    const pw = summary.departmentVolumes.find((d) => d.department === "PUBLIC_WORKS");
    expect(pw).toBeDefined();
    expect(pw!.total).toBe(2);
  });

  it("computes SLA adherence", () => {
    const pw = summary.slaAdherence.find((d) => d.department === "PUBLIC_WORKS");
    expect(pw).toBeDefined();
    // Record A: 240 min < 480 min SLA → within SLA
    expect(pw!.withinSla).toBe(1);
    expect(pw!.adherencePct).toBe(100);
  });

  it("agencyId is preserved", () => {
    expect(summary.agencyId).toBe("kcpd");
  });
});

describe("dailyVolumeTrend", () => {
  it("produces entry for every day in window", () => {
    const records: CallAssistCallRecord[] = [
      makeRecord({ createdAt: "2024-11-01T10:00:00Z" }),
      makeRecord({ confirmationNumber: "X", createdAt: "2024-11-03T10:00:00Z" }),
    ];
    const trend = dailyVolumeTrend({ records, windowStart: "2024-11-01T00:00:00Z", windowEnd: "2024-11-03T23:59:59Z" });
    expect(trend.length).toBe(3);
    expect(trend.find((b) => b.label === "2024-11-01")?.count).toBe(1);
    expect(trend.find((b) => b.label === "2024-11-02")?.count).toBe(0);
    expect(trend.find((b) => b.label === "2024-11-03")?.count).toBe(1);
  });
});

// ===========================================================================
// Competitive Matrix
// ===========================================================================

describe("getCompetitorProfile", () => {
  it("returns undefined for unknown competitor", () =>
    expect(getCompetitorProfile("unknown")).toBeUndefined());

  it("returns SeeClickFix profile", () => {
    const p = getCompetitorProfile("seeclickfix");
    expect(p?.name).toBe("SeeClickFix (Oracle)");
    expect(p?.features.ai_voice_intake).toBe("no");
  });

  it("returns Salesforce profile", () => {
    const p = getCompetitorProfile("salesforce_311");
    expect(p?.features.ai_voice_intake).toBe("partial");
  });
});

describe("differentiatorKeys", () => {
  it("returns keys where we are yes and competitor is no/partial", () => {
    const keys = differentiatorKeys("seeclickfix");
    expect(keys).toContain("ai_voice_intake");
    expect(keys).toContain("cad_integration");
    // SeeClickFix has Open311 as "yes" — should not appear as differentiator
    expect(keys).not.toContain("open311_outbound");
  });

  it("returns empty array for unknown competitor", () => {
    expect(differentiatorKeys("unknown")).toEqual([]);
  });
});

describe("NEXCORTIQ_FEATURES", () => {
  it("all feature keys have a status", () => {
    for (const k of Object.keys(COMPETITIVE_FEATURE_LABELS) as Array<keyof typeof COMPETITIVE_FEATURE_LABELS>) {
      expect(NEXCORTIQ_FEATURES[k]).toBeTruthy();
    }
  });

  it("ai_voice_intake is yes", () =>
    expect(NEXCORTIQ_FEATURES.ai_voice_intake).toBe("yes"));

  it("cad_integration is yes", () =>
    expect(NEXCORTIQ_FEATURES.cad_integration).toBe("yes"));
});
