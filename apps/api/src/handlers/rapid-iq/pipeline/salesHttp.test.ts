import { describe, expect, it, vi, beforeEach } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { RapidIqSalesSequence, UserContext } from "rapid-cortex-shared";

const getUserContext = vi.fn();
const isUserAccountActive = vi.fn(() => true);
const listSalesSequences = vi.fn(async () => [] as RapidIqSalesSequence[]);
const listSalesDrafts = vi.fn(async () => []);
const listByAgency = vi.fn(async () => []);

vi.mock("../../../lib/auth.js", () => ({
  getUserContext: (...args: unknown[]) => getUserContext(...args),
  isUserAccountActive: (...args: unknown[]) => isUserAccountActive(...args),
  ACCOUNT_INACTIVE_MESSAGE: "User account is not active.",
}));

vi.mock("../../../lib/rapid-iq/intel-db.js", () => ({
  listIntelOpportunities: vi.fn(async () => []),
  listIntelWatches: vi.fn(async () => []),
  seedDefaultIntelWatches: vi.fn(async () => 0),
  seedDefaultTransitWatches: vi.fn(async () => 0),
  getIntelOpportunity: vi.fn(async () => null),
  getIntelWatch: vi.fn(async () => null),
  putIntelWatch: vi.fn(),
  updateIntelOpportunityFields: vi.fn(),
  updateIntelWatchFields: vi.fn(),
}));

vi.mock("./rfp-unified-counter.js", () => ({
  getRfpCountSnapshot: vi.fn(async () => null),
}));

vi.mock("../../../lib/rapid-iq/sales-automation-db.js", () => ({
  listSalesSequences: (...args: unknown[]) => listSalesSequences(...args),
  listSalesDrafts: (...args: unknown[]) => listSalesDrafts(...args),
  getSalesSequence: vi.fn(async () => null),
  getSalesDraft: vi.fn(async () => null),
  putSalesSequence: vi.fn(),
  putSalesDraft: vi.fn(),
  recordSalesSend: vi.fn(),
  putSalesUnsubscribe: vi.fn(),
  isLocallyUnsubscribed: vi.fn(async () => false),
  hasRecentSend: vi.fn(async () => false),
  getOutlookConnection: vi.fn(async () => null),
  putOutlookConnection: vi.fn(),
  deleteOutlookConnection: vi.fn(),
}));

vi.mock("../../../repositories/conferenceRepository.js", () => ({
  ConferenceRepository: class {
    async listByAgency() {
      return listByAgency();
    }
  },
}));

vi.mock("./sales-automation-send.js", () => ({
  sendDueStepsNow: vi.fn(async () => ({ sent: 0, skipped: 0 })),
  handler: vi.fn(),
}));

vi.mock("../../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    async create() {
      return undefined;
    }
  },
}));

import { handler } from "./signalHttp.js";
import * as salesDb from "../../../lib/rapid-iq/sales-automation-db.js";

function makeEvent(
  method: string,
  path: string,
  user: UserContext | null,
  body?: unknown,
): APIGatewayProxyEventV2 {
  getUserContext.mockResolvedValue(user);
  return {
    version: "2.0",
    routeKey: `${method} ${path}`,
    rawPath: path,
    requestContext: { http: { method, path } } as APIGatewayProxyEventV2["requestContext"],
    headers: {},
    body: body === undefined ? undefined : JSON.stringify(body),
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

const admin: UserContext = {
  userId: "u-admin",
  agencyId: "platform",
  role: "rcadmin",
  email: "admin@rapidcortex.us",
};

const dispatcher: UserContext = {
  userId: "u-disp",
  agencyId: "agency-1",
  role: "dispatcher",
  email: "disp@example.com",
};

describe("sales automation HTTP RBAC", () => {
  beforeEach(() => {
    getUserContext.mockReset();
    isUserAccountActive.mockReturnValue(true);
    listSalesSequences.mockResolvedValue([]);
    listSalesDrafts.mockResolvedValue([]);
    listByAgency.mockResolvedValue([]);
    process.env.ENABLE_RAPID_IQ_PIPELINE = "true";
    process.env.ENABLE_SALES_AUTOMATION = "true";
    process.env.OUTLOOK_GRAPH_MOCK = "1";
  });

  it("returns 401 when unauthenticated", async () => {
    const result = await handler(makeEvent("GET", "/api/rapid-iq/sales-automation/metrics", null));
    expect((result as { statusCode: number }).statusCode).toBe(401);
  });

  it("returns 403 for dispatcher", async () => {
    const result = await handler(
      makeEvent("GET", "/api/rapid-iq/sales-automation/sequences", dispatcher),
    );
    expect((result as { statusCode: number }).statusCode).toBe(403);
  });

  it("allows rcadmin to list sequences and metrics", async () => {
    const seq = await handler(makeEvent("GET", "/api/rapid-iq/sales-automation/sequences", admin));
    expect((seq as { statusCode: number }).statusCode).toBe(200);
    const metrics = await handler(makeEvent("GET", "/api/rapid-iq/sales-automation/metrics", admin));
    expect((metrics as { statusCode: number }).statusCode).toBe(200);
    const campaigns = await handler(
      makeEvent("GET", "/api/rapid-iq/sales-automation/campaigns", admin),
    );
    expect((campaigns as { statusCode: number }).statusCode).toBe(200);
  });

  it("allows rcadmin to read Outlook campaign-send status", async () => {
    const result = await handler(
      makeEvent("GET", "/api/rapid-iq/sales-automation/outlook/status", admin),
    );
    expect((result as { statusCode: number }).statusCode).toBe(200);
    const body = JSON.parse((result as { body: string }).body) as {
      outlook: { connected: boolean; mock: boolean };
    };
    expect(body.outlook.connected).toBe(false);
    expect(body.outlook.mock).toBe(true);
  });

  it("queues a bulk campaign of 100+ prospect drafts", async () => {
    const recipients = Array.from({ length: 120 }, (_, i) => ({
      email: `dir${i}@example.gov`,
      agencyName: `Agency ${i}`,
      recipientName: `Pat ${i}`,
    }));
    const result = await handler(
      makeEvent("POST", "/api/rapid-iq/sales-automation/bulk", admin, {
        vertical: "PSAP",
        campaignName: "911 Core outbound",
        recipients,
      }),
    );
    expect((result as { statusCode: number }).statusCode).toBe(200);
    const body = JSON.parse((result as { body: string }).body) as {
      result: { created: number; duplicates: number };
    };
    expect(body.result.created).toBe(120);
    expect(body.result.duplicates).toBe(0);
  });

  it("lets rcadmin PATCH auto-generated sequence emails", async () => {
    const sequence = {
      sequenceId: "seq_edit",
      triggerId: "t1",
      triggerType: "campaign" as const,
      vertical: "PSAP" as const,
      recipientEmail: "chief@franklin.gov",
      agencyName: "Franklin County",
      status: "draft" as const,
      autoApprove: false,
      steps: [
        {
          stepId: "s1",
          stepNumber: 1 as const,
          label: "initial" as const,
          delayDays: 0,
          status: "pending" as const,
          email: { subject: "Old", bodyText: "Old body" },
        },
      ],
      createdAt: "2026-09-16T00:00:00.000Z",
      updatedAt: "2026-09-16T00:00:00.000Z",
      attribution: {},
    };
    vi.mocked(salesDb.getSalesSequence).mockResolvedValue(sequence as never);
    vi.mocked(salesDb.putSalesSequence).mockResolvedValue(undefined as never);
    const result = await handler(
      makeEvent("PATCH", "/api/rapid-iq/sales-automation/sequences/seq_edit", admin, {
        steps: [{ stepNumber: 1, email: { subject: "Edited subject", bodyText: "Edited body" } }],
      }),
    );
    expect((result as { statusCode: number }).statusCode).toBe(200);
    const body = JSON.parse((result as { body: string }).body) as {
      sequence: { steps: { email: { subject: string } }[] };
    };
    expect(body.sequence.steps[0]?.email.subject).toBe("Edited subject");
  });
});
