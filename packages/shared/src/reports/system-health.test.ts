import { describe, expect, it } from "vitest";
import {
  buildSystemHealthReport,
  calendarMonthLabelUtc,
  calendarMonthRangeUtc,
  classifyDeviceFreshness,
  isOpenIncidentStatus,
  isResolvedIncidentStatus,
  isSystemHealthActivationType,
  previousCalendarMonthRangeUtc,
} from "./system-health";

describe("calendar month ranges", () => {
  it("returns the UTC month containing the given instant", () => {
    const { start, end } = calendarMonthRangeUtc(new Date("2026-09-20T16:00:00.000Z"));
    expect(start).toBe("2026-09-01T00:00:00.000Z");
    expect(end).toBe("2026-09-30T23:59:59.999Z");
    expect(calendarMonthLabelUtc(start)).toBe("September 2026");
  });

  it("returns the previous complete UTC month", () => {
    const { start, end } = previousCalendarMonthRangeUtc(new Date("2026-09-20T16:00:00.000Z"));
    expect(start).toBe("2026-08-01T00:00:00.000Z");
    expect(end).toBe("2026-08-31T23:59:59.999Z");
  });
});

describe("incident and activation classifiers", () => {
  it("treats active/in_progress as open and completed/archived as resolved", () => {
    expect(isOpenIncidentStatus("active")).toBe(true);
    expect(isOpenIncidentStatus("in_progress")).toBe(true);
    expect(isResolvedIncidentStatus("completed")).toBe(true);
    expect(isResolvedIncidentStatus("archived")).toBe(true);
    expect(isOpenIncidentStatus("completed")).toBe(false);
  });

  it("recognizes activation audit types", () => {
    expect(isSystemHealthActivationType("public.report.submitted")).toBe(true);
    expect(isSystemHealthActivationType("qr_nfc.code.created")).toBe(true);
    expect(isSystemHealthActivationType("auth.login.success")).toBe(false);
  });
});

describe("device freshness", () => {
  const now = Date.parse("2026-09-20T16:00:00.000Z");

  it("is online within 15 minutes, stale then offline", () => {
    expect(
      classifyDeviceFreshness({ id: "a", label: "Cam A", lastHeartbeat: "2026-09-20T15:50:00.000Z" }, now),
    ).toBe("online");
    expect(
      classifyDeviceFreshness({ id: "b", label: "Cam B", lastHeartbeat: "2026-09-20T15:20:00.000Z" }, now),
    ).toBe("stale");
    expect(
      classifyDeviceFreshness({ id: "c", label: "Cam C", lastHeartbeat: "2026-09-20T12:00:00.000Z" }, now),
    ).toBe("offline");
  });
});

describe("buildSystemHealthReport", () => {
  it("summarizes uptime, activations, resolved incidents, and open issues", () => {
    const { rows, summary } = buildSystemHealthReport({
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-08-31T23:59:59.999Z",
      nowMs: Date.parse("2026-09-01T00:00:00.000Z"),
      devices: [
        { id: "cam-1", label: "Lobby", lastHeartbeat: "2026-08-31T23:55:00.000Z", status: "online" },
        { id: "cam-2", label: "Dock", lastHeartbeat: "2026-08-31T22:00:00.000Z" },
      ],
      incidentsCreatedInRange: [
        { incidentId: "i1", status: "completed", category: "medical", createdAt: "2026-08-04T12:00:00.000Z" },
        { incidentId: "i2", status: "active", category: "fire", createdAt: "2026-08-20T12:00:00.000Z" },
      ],
      openIncidents: [
        { incidentId: "i2", status: "active", category: "fire", createdAt: "2026-08-20T12:00:00.000Z", urgency: "high" },
      ],
      auditEvents: [
        { type: "public.report.submitted", createdAt: "2026-08-05T10:00:00.000Z", actorId: "anon" },
        { type: "auth.login.success", createdAt: "2026-08-05T11:00:00.000Z", actorId: "u1" },
      ],
    });

    expect(summary.devicesTotal).toBe(2);
    expect(summary.devicesOnline).toBe(1);
    expect(summary.activations).toBe(1);
    expect(summary.resolvedIncidents).toBe(1);
    expect(summary.openIssues).toBe(1);
    expect(summary.uptimePercent).toBe(50);
    expect(rows.some((r) => r.section === "summary" && r.metric === "Device uptime %")).toBe(true);
    expect(rows.some((r) => r.section === "activation" && r.type === "public.report.submitted")).toBe(true);
    expect(rows.some((r) => r.section === "open" && r.incidentId === "i2")).toBe(true);
  });
});
