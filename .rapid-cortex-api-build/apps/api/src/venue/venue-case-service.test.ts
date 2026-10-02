/**
 * Unit tests for venue case state machine transitions (RFP 2396IP, Build Item 2).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend, mockAuditCreate } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockAuditCreate: vi.fn(),
}));

vi.mock("@aws-sdk/client-dynamodb", () => ({ DynamoDBClient: class DynamoDBClient {} }));
vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
  GetCommand: class GetCommand {
    type = "GetCommand";
    constructor(public readonly input: unknown) {}
  },
  PutCommand: class PutCommand {
    type = "PutCommand";
    constructor(public readonly input: unknown) {}
  },
  UpdateCommand: class UpdateCommand {
    type = "UpdateCommand";
    constructor(public readonly input: unknown) {}
  },
  QueryCommand: class QueryCommand {
    type = "QueryCommand";
    constructor(public readonly input: unknown) {}
  },
}));

vi.mock("../venue-incident-realtime.js", () => ({
  broadcastVenueIncidentStatusChanged: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = mockAuditCreate;
  },
}));

vi.mock("../venue-evidence-service.js", () => ({
  appendVenueAudit: vi.fn().mockResolvedValue(undefined),
}));

process.env.VENUE_CONFIG_TABLE = "test-venue-config";

import { performCaseAction } from "./venue-case-service.js";
import type { VenueIncidentRecord } from "./venue-types.js";

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeIncident(overrides: Partial<VenueIncidentRecord> = {}): VenueIncidentRecord {
  return {
    pk: "VENUE#MBS",
    sk: "INCIDENT#inc_001",
    incidentId: "inc_001",
    venueCode: "MBS",
    agencyId: "agency_abc",
    zoneCode: "S124",
    zoneLabel: "Section 124",
    type: "security",
    source: "qr",
    status: "open",
    description: "Test",
    callerPhone: "+15551234567",
    hasMedia: false,
    mediaUrls: [],
    cameraRefs: [],
    assignedTo: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function mockGetReturns(incident: VenueIncidentRecord | null): void {
  mockSend.mockImplementation((cmd: { type?: string }) => {
    if (cmd.type === "GetCommand") {
      return Promise.resolve({ Item: incident ?? undefined });
    }
    return Promise.resolve({});
  });
}

const BASE_PARAMS = {
  agencyId: "agency_abc",
  venueCode: "MBS",
  incidentId: "inc_001",
  actorId: "user_001",
  actorLabel: "Officer Smith",
};

describe("performCaseAction — allowed transitions", () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockAuditCreate.mockReset().mockResolvedValue(undefined);
  });

  it("open → assigned via assign action", async () => {
    mockGetReturns(makeIncident({ status: "open" }));
    const result = await performCaseAction({
      ...BASE_PARAMS,
      body: { action: "assign", assigneeId: "user_002", assigneeLabel: "Officer Jones" },
    });
    expect(result.previousStatus).toBe("open");
    expect(result.newStatus).toBe("assigned");
    expect(result.action).toBe("assign");
  });

  it("assigned → responding via investigate action", async () => {
    mockGetReturns(makeIncident({ status: "assigned" }));
    const result = await performCaseAction({
      ...BASE_PARAMS,
      body: { action: "investigate" },
    });
    expect(result.previousStatus).toBe("assigned");
    expect(result.newStatus).toBe("responding");
  });

  it("responding → pending_approval via submit_for_approval", async () => {
    mockGetReturns(makeIncident({ status: "responding" }));
    const result = await performCaseAction({
      ...BASE_PARAMS,
      body: { action: "submit_for_approval" },
    });
    expect(result.newStatus).toBe("pending_approval");
  });

  it("pending_approval → approved via approve action", async () => {
    mockGetReturns(makeIncident({ status: "pending_approval" }));
    const result = await performCaseAction({
      ...BASE_PARAMS,
      body: { action: "approve" },
    });
    expect(result.newStatus).toBe("approved");
  });

  it("resolved → closed via close action", async () => {
    mockGetReturns(makeIncident({ status: "resolved" }));
    const result = await performCaseAction({
      ...BASE_PARAMS,
      body: { action: "close" },
    });
    expect(result.newStatus).toBe("closed");
  });

  it("closed → reopened via reopen action", async () => {
    mockGetReturns(makeIncident({ status: "closed" }));
    const result = await performCaseAction({
      ...BASE_PARAMS,
      body: { action: "reopen" },
    });
    expect(result.newStatus).toBe("reopened");
  });

  it("open → escalated via escalate action", async () => {
    mockGetReturns(makeIncident({ status: "open" }));
    const result = await performCaseAction({
      ...BASE_PARAMS,
      body: { action: "escalate", note: "Situation deteriorating" },
    });
    expect(result.newStatus).toBe("escalated");
  });
});

describe("performCaseAction — invalid transitions", () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockAuditCreate.mockReset().mockResolvedValue(undefined);
  });

  it("throws 422 for closed → assigned (not allowed)", async () => {
    mockGetReturns(makeIncident({ status: "closed" }));
    await expect(
      performCaseAction({
        ...BASE_PARAMS,
        body: { action: "assign", assigneeId: "user_002" },
      }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it("throws 422 for approved → assigned (not allowed)", async () => {
    mockGetReturns(makeIncident({ status: "approved" }));
    await expect(
      performCaseAction({
        ...BASE_PARAMS,
        body: { action: "assign", assigneeId: "user_002" },
      }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it("throws 422 for open → approved (skipping steps)", async () => {
    mockGetReturns(makeIncident({ status: "open" }));
    await expect(
      performCaseAction({
        ...BASE_PARAMS,
        body: { action: "approve" },
      }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});

describe("performCaseAction — non-status actions", () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockAuditCreate.mockReset().mockResolvedValue(undefined);
  });

  it("link action keeps status unchanged", async () => {
    mockGetReturns(makeIncident({ status: "responding" }));
    const result = await performCaseAction({
      ...BASE_PARAMS,
      body: { action: "link", linkedIncidentId: "inc_linked_99" },
    });
    expect(result.previousStatus).toBe("responding");
    expect(result.newStatus).toBe("responding");
  });

  it("update_fields action keeps status unchanged", async () => {
    mockGetReturns(makeIncident({ status: "open" }));
    const result = await performCaseAction({
      ...BASE_PARAMS,
      body: {
        action: "update_fields",
        fields: { injuries: true, disposition: "Verbal warning issued" },
      },
    });
    expect(result.newStatus).toBe("open");
  });
});

describe("performCaseAction — incident not found", () => {
  it("throws 404 when incident does not exist", async () => {
    mockSend.mockResolvedValue({ Item: undefined });
    await expect(
      performCaseAction({
        ...BASE_PARAMS,
        body: { action: "assign", assigneeId: "user_002" },
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("performCaseAction — audit failure is non-fatal", () => {
  it("completes successfully even if audit repo throws", async () => {
    mockGetReturns(makeIncident({ status: "open" }));
    mockAuditCreate.mockRejectedValueOnce(new Error("Audit DDB unavailable"));
    const result = await performCaseAction({
      ...BASE_PARAMS,
      body: { action: "assign", assigneeId: "user_002" },
    });
    expect(result.newStatus).toBe("assigned");
  });
});

describe("performCaseAction — agencyId cross-tenant protection", () => {
  it("throws 403 when agencyId mismatches incident", async () => {
    mockGetReturns(makeIncident({ status: "open", agencyId: "other_agency" }));
    await expect(
      performCaseAction({
        ...BASE_PARAMS,
        agencyId: "agency_abc",
        body: { action: "assign", assigneeId: "user_002" },
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
