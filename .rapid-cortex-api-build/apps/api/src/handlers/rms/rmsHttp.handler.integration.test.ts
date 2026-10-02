import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IncidentReport } from "rapid-cortex-shared";
import { invokeHttpHandler, makeAuthenticatedEvent } from "../handlerTestUtils.js";

const { getReport, finalizeReport } = vi.hoisted(() => ({
  getReport: vi.fn(),
  finalizeReport: vi.fn(),
}));

vi.mock("../../lib/rms/reports-db.js", () => ({
  getReport,
  finalizeReport,
  listReports: vi.fn(),
  updateReport: vi.fn(),
  getRmsContextCache: vi.fn(),
  setRmsContextCache: vi.fn(),
  saveReport: vi.fn(),
}));

vi.mock("../../lib/rms/audit.js", () => ({
  auditRmsMutation: vi.fn(),
  AUDIT_EVENT_TYPES: {
    RMS_REPORT_FINALIZED: "rms.report.finalized",
    RMS_REPORT_EDITED: "rms.report.edited",
    RMS_REPORT_PUSHED: "rms.report.pushed",
  },
}));

import { handler } from "./rmsHttp.js";

function nibrsClassification(): NonNullable<IncidentReport["nibrsClassification"]> {
  return {
    offenseCode: "13A",
    offenseGroup: "A",
    offenseDescription: "Aggravated Assault",
    locationTypeCode: "20",
    locationTypeDescription: "Residence/Home",
    attemptedCompleted: "C",
    confidence: 82,
    aiRationale: "Caller described a physical assault with injury.",
  };
}

function draftReport(overrides: Partial<IncidentReport> = {}): IncidentReport {
  return {
    reportId: "rpt-1",
    agencyId: "agency-a",
    incidentId: "inc-1",
    incidentType: "Assault",
    incidentDate: "2026-08-15",
    incidentTime: "08:00",
    incidentAddress: "100 Main St",
    incidentCity: "Austin",
    incidentState: "TX",
    suspects: [],
    victims: [],
    witnesses: [],
    vehicles: [],
    narrative: { officerNarrative: "Caller reported an assault." },
    nibrsClassification: nibrsClassification(),
    nibrsConfirmed: true,
    status: "draft",
    createdAt: "2026-08-15T12:00:00.000Z",
    updatedAt: "2026-08-15T12:00:00.000Z",
    createdBy: "test-user",
    transcriptWordCount: 40,
    extractedEntitiesCount: 2,
    ...overrides,
  };
}

function finalizeEvent(opts: {
  role: string;
  body?: string;
  reportId?: string;
}) {
  const reportId = opts.reportId ?? "rpt-1";
  return makeAuthenticatedEvent({
    role: opts.role,
    agencyId: "agency-a",
    email: `${opts.role}@agency-a.example`,
    rawPath: `/api/rms/reports/${reportId}/finalize`,
    routeKey: "POST /api/rms/reports/{reportId}/finalize",
    pathParameters: { reportId },
    body: opts.body,
  });
}

describe("rmsHttp finalize", () => {
  beforeEach(() => {
    getReport.mockReset();
    finalizeReport.mockReset();
  });

  it("returns 403 when a dispatcher tries to finalize", async () => {
    const res = await invokeHttpHandler(
      handler,
      finalizeEvent({
        role: "dispatcher",
        body: JSON.stringify({ nibrsConfirmed: true }),
      }),
    );
    expect(res.statusCode).toBe(403);
    expect(finalizeReport).not.toHaveBeenCalled();
    expect(getReport).not.toHaveBeenCalled();
  });

  it("returns 400 when nibrsConfirmed is missing", async () => {
    const res = await invokeHttpHandler(
      handler,
      finalizeEvent({
        role: "supervisor",
        body: JSON.stringify({}),
      }),
    );
    expect(res.statusCode).toBe(400);
    const parsed = JSON.parse(res.body ?? "{}") as { error?: string };
    expect(parsed.error).toMatch(/nibrsConfirmed/i);
    expect(finalizeReport).not.toHaveBeenCalled();
  });

  it("returns 400 when the report has no NIBRS classification", async () => {
    getReport.mockResolvedValue(
      draftReport({ nibrsClassification: undefined, nibrsConfirmed: true }),
    );
    const res = await invokeHttpHandler(
      handler,
      finalizeEvent({
        role: "supervisor",
        body: JSON.stringify({ nibrsConfirmed: true }),
      }),
    );
    expect(res.statusCode).toBe(400);
    const parsed = JSON.parse(res.body ?? "{}") as { error?: string };
    expect(parsed.error).toMatch(/NIBRS classification/i);
    expect(finalizeReport).not.toHaveBeenCalled();
  });
});
