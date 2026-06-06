import { describe, expect, it } from "vitest";
import {
  deriveWorstSystemStatus,
  filterIncidentHistoryToWindow,
  getActiveIncidents,
  getCurrentSystemStatus,
  getIncidentHistory90Days,
  getScheduledMaintenance,
  getUptimeMetrics,
} from "@/lib/rapid-cortex/status/status-data";
import type { StatusIncident } from "@/lib/rapid-cortex/status/status-types";

describe("status data defaults", () => {
  it("aggregates overall status from components (defaults operational)", () => {
    expect(getCurrentSystemStatus()).toBe("operational");
    expect(getActiveIncidents()).toEqual([]);
  });

  it("deriveWorstSystemStatus picks the highest-severity state", () => {
    expect(deriveWorstSystemStatus(["operational", "degraded"])).toBe("degraded");
    expect(deriveWorstSystemStatus(["operational", "major_outage"])).toBe("major_outage");
    expect(deriveWorstSystemStatus(["maintenance", "degraded"])).toBe("degraded");
  });

  it("returns empty default maintenance and uptime until public telemetry is connected", () => {
    expect(getScheduledMaintenance()).toEqual([]);
    expect(getUptimeMetrics()).toEqual([]);
  });

  it("limits incident history to 90 days", () => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    const incidents: StatusIncident[] = [
      {
        id: "within-window",
        title: "Within window",
        status: "resolved",
        severity: "minor",
        startedAt: "2026-04-15T00:00:00.000Z",
        resolvedAt: "2026-04-15T01:00:00.000Z",
        summary: "Test incident in range.",
        updates: [],
      },
      {
        id: "out-of-window",
        title: "Out of window",
        status: "resolved",
        severity: "minor",
        startedAt: "2025-12-01T00:00:00.000Z",
        resolvedAt: "2025-12-01T01:00:00.000Z",
        summary: "Test incident out of range.",
        updates: [],
      },
    ];

    const filtered = filterIncidentHistoryToWindow(incidents, 90, now);
    expect(filtered.map((incident) => incident.id)).toEqual(["within-window"]);
    expect(getIncidentHistory90Days(now)).toEqual([]);
  });
});
