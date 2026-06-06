import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import type { Incident, UserContext } from "rapid-cortex-shared";

const mockResolve = vi.hoisted(() => vi.fn());
const mockListByAddr = vi.hoisted(() => vi.fn());
const mockListPremise = vi.hoisted(() => vi.fn());
const mockGetCallerData = vi.hoisted(() => vi.fn());

vi.mock("../lib/incidentReadAccess.js", () => ({
  resolveIncidentRead: mockResolve,
}));

vi.mock("../repositories/incidentRepository.js", () => ({
  IncidentRepository: class {
    listByAgencyAndCallerAddressNormalized = mockListByAddr;
  },
}));

vi.mock("../repositories/premiseNotesRepository.js", () => ({
  PremiseNotesRepository: class {
    listForAddress = mockListPremise;
    createNote = vi.fn();
  },
}));

vi.mock("rapid-cortex-integrations", () => ({
  MockCadAdapter: class {
    getCallerData = mockGetCallerData;
  },
}));

import { CallerCardService } from "./callerCardService.js";

const user: UserContext = {
  userId: "u1",
  agencyId: "agency-a",
  email: "a@test",
  role: "dispatcher",
};

function baseIncident(over: Partial<Incident> = {}): Incident {
  return {
    incidentId: "inc-1",
    agencyId: "agency-a",
    title: "t",
    category: "unknown",
    urgency: "moderate",
    status: "active",
    source: "manual",
    confidence: null,
    escalationFlag: false,
    summary: "S",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    callerAddressLine: "100 Main St",
    callerAddressNormalized: "100 main st",
    ...over,
  };
}

describe("CallerCardService", () => {
  const svc = new CallerCardService();

  beforeAll(() => {
    mockGetCallerData.mockResolvedValue({
      cadStatus: "mock",
      callerName: "John",
      callbackPhone: "555",
    });
  });

  beforeEach(() => {
    mockResolve.mockReset();
    mockListByAddr.mockReset();
    mockListPremise.mockReset();
    mockGetCallerData.mockClear();
  });

  it("returns aggregated card with prior incidents and mock CAD", async () => {
    const inc = baseIncident();
    mockResolve.mockResolvedValue({ incident: inc, kind: "owner" });
    mockListPremise.mockResolvedValue([
      { noteId: "n1", text: "Gate code", createdAt: "2024-12-01T00:00:00.000Z", createdBy: "u0", source: "manual_note" as const },
    ]);
    mockListByAddr.mockResolvedValue([
      {
        ...inc,
        incidentId: "inc-old",
        createdAt: "2024-06-01T00:00:00.000Z",
        title: "Old",
        summary: "Old sum",
        status: "closed" as const,
        category: "medical" as const,
      },
    ]);

    const card = await svc.get("inc-1", user);
    expect(card).not.toBeNull();
    expect(card!.cadData.callerName).toBe("John");
    expect(card!.cadData.status).toBe("mock");
    expect(card!.premiseNotes).toHaveLength(1);
    expect(card!.priorIncidents[0]!.incidentId).toBe("inc-old");
  });

  it("returns null for shared (cross-jurisdiction) incident", async () => {
    mockResolve.mockResolvedValue({ incident: baseIncident(), kind: "shared" });
    const card = await svc.get("inc-1", user);
    expect(card).toBeNull();
  });

  it("marks CAD unavailable when adapter throws", async () => {
    mockGetCallerData.mockRejectedValueOnce(new Error("cad down"));
    const inc = baseIncident();
    mockResolve.mockResolvedValue({ incident: inc, kind: "owner" });
    mockListPremise.mockResolvedValue([]);
    mockListByAddr.mockResolvedValue([]);

    const card = await svc.get("inc-1", user);
    expect(card!.cadData.status).toBe("unavailable");
  });
});
