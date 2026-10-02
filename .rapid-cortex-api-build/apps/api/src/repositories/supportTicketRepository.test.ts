import { describe, expect, it } from "vitest";
import type { SupportTicketRecord } from "rapid-cortex-shared";
import { computeTicketBoardMetrics, formatTicketId } from "./supportTicketRepository.js";

function ticket(partial: Partial<SupportTicketRecord>): SupportTicketRecord {
  return {
    ticketId: "SUP-1",
    agencyId: "a1",
    agencyName: "Agency",
    status: "OPEN",
    channel: "web_form",
    severity: "SEV2",
    category: "bug_report",
    submittedByUserId: "u",
    submittedByName: "Pat",
    submittedByEmail: "p@x.com",
    submittedByRole: "dispatcher",
    subject: "s",
    description: "d",
    notes: [],
    activities: [],
    createdAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
    updatedAt: new Date().toISOString(),
    ttl: 1,
    ...partial,
  };
}

describe("supportTicketRepository helpers", () => {
  it("formats sequential ticket ids as SUP-1001", () => {
    expect(formatTicketId(1)).toBe("SUP-0001");
    expect(formatTicketId(1001)).toBe("SUP-1001");
  });

  it("computes operational board metrics", () => {
    const month = new Date().toISOString().slice(0, 7);
    const metrics = computeTicketBoardMetrics([
      ticket({ severity: "SEV1", status: "ESCALATED" }),
      ticket({ severity: "SEV2", status: "OPEN" }),
      ticket({
        status: "RESOLVED",
        severity: "SEV3",
        createdAt: `${month}-01T00:00:00.000Z`,
        resolvedAt: `${month}-02T12:00:00.000Z`,
      }),
      ticket({ status: "CLOSED", severity: "SEV4" }),
    ]);
    expect(metrics.totalOpen).toBe(2);
    expect(metrics.sev1Active).toBe(1);
    expect(metrics.sev2Active).toBe(1);
    expect(metrics.resolvedThisMonth).toBe(1);
    expect(metrics.avgResolutionHours).toBe(36);
    expect(metrics.oldestOpenHours).toBeGreaterThanOrEqual(4);
  });
});
