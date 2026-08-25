/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IncidentReport, UserContext } from "rapid-cortex-shared";
import { ReportWriterPanel } from "./report-writer-panel";

const sessionUser = vi.hoisted(() => ({
  current: null as UserContext | null,
}));

vi.mock("@/components/auth/session-context", () => ({
  useSession: () => ({
    user: sessionUser.current,
    isLoading: false,
    refresh: async () => sessionUser.current,
  }),
}));

function userFor(role: UserContext["role"]): UserContext {
  return {
    userId: `${role}-1`,
    agencyId: "agency-a",
    role,
    email: `${role}@agency-a.example`,
  };
}

function reviewingReport(): IncidentReport {
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
    nibrsClassification: {
      offenseCode: "13A",
      offenseGroup: "A",
      offenseDescription: "Aggravated Assault",
      locationTypeCode: "20",
      locationTypeDescription: "Residence/Home",
      attemptedCompleted: "C",
      confidence: 82,
      aiRationale: "Caller described a physical assault with injury.",
    },
    nibrsConfirmed: true,
    status: "draft",
    createdAt: "2026-08-15T12:00:00.000Z",
    updatedAt: "2026-08-15T12:00:00.000Z",
    createdBy: "test-user",
    transcriptWordCount: 40,
    extractedEntitiesCount: 2,
  };
}

function sseGenerateResponse(report: IncidentReport): Response {
  const body = `event: complete\ndata: ${JSON.stringify({ report })}\n\n`;
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function renderPanel() {
  return render(
    <ReportWriterPanel
      incidentId="inc-1"
      agencyId="agency-a"
      transcript="Caller reported an assault at 100 Main."
      extractedEntities={{ incidentType: "Assault", location: "100 Main St" }}
    />,
  );
}

describe("ReportWriterPanel finalize visibility", () => {
  beforeEach(() => {
    sessionUser.current = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/rms/reports/generate")) {
          return sseGenerateResponse(reviewingReport());
        }
        return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("does not render Finalize for a dispatcher after generate", async () => {
    sessionUser.current = userFor("dispatcher");
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Generate Incident Report/i }));
    await waitFor(() => {
      expect(screen.getByText(/Aggravated Assault/i)).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /^Finalize Report$/ })).toBeNull();
    expect(screen.queryByText(/Confirm NIBRS to finalize/i)).toBeNull();
  });

  it("renders Finalize for a supervisor after generate when NIBRS is confirmed", async () => {
    sessionUser.current = userFor("supervisor");
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Generate Incident Report/i }));
    expect(await screen.findByRole("button", { name: /^Finalize Report$/ })).toBeTruthy();
  });
});
