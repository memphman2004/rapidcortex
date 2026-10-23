import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PsapProspect } from "rapid-cortex-shared";
import { PsapProspectTable } from "./PsapProspectTable";

function prospect(overrides: Partial<PsapProspect> = {}): PsapProspect {
  return {
    psapId: "p1",
    psapName: "Example PSAP",
    county: "Clarke",
    state: "GA",
    city: "Athens",
    phone: "555-0100",
    fips: "",
    latitude: 0,
    longitude: 0,
    outreachStatus: "CALLED",
    activities: [
      {
        activityId: "a2",
        type: "email",
        description: "Follow-up",
        performedByUserId: "u2",
        performedByName: "Bea Ortiz",
        performedAt: "2026-04-02T15:00:00.000Z",
      },
      {
        activityId: "a1",
        type: "call",
        description: "Intro",
        performedByUserId: "u1",
        performedByName: "Ada Chen",
        performedAt: "2026-04-01T15:00:00.000Z",
      },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-04-02T15:00:00.000Z",
    importedFrom: "test",
    ...overrides,
  };
}

describe("PsapProspectTable contact column", () => {
  it("shows how many times, when, who, and how", () => {
    const html = renderToStaticMarkup(
      createElement(PsapProspectTable, {
        items: [prospect()],
        total: 1,
        page: 1,
        pageSize: 25,
        hasMore: false,
        onSelect: () => undefined,
        onPageChange: () => undefined,
        onSort: () => undefined,
        onStatusChange: () => undefined,
      }),
    );
    expect(html).toContain("2 times");
    expect(html).toContain("Email · Bea Ortiz");
    expect(html).toContain("Contacted");
  });

  it("shows Never when the prospect has not been contacted", () => {
    const html = renderToStaticMarkup(
      createElement(PsapProspectTable, {
        items: [prospect({ outreachStatus: "UNCONTACTED", activities: [] })],
        total: 1,
        page: 1,
        pageSize: 25,
        hasMore: false,
        onSelect: () => undefined,
        onPageChange: () => undefined,
        onSort: () => undefined,
        onStatusChange: () => undefined,
      }),
    );
    expect(html).toContain("Never");
  });
});
