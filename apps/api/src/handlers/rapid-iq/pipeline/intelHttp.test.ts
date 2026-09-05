import { describe, expect, it, vi, beforeEach } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { UserContext } from "rapid-cortex-shared";

const getUserContext = vi.fn();
const isUserAccountActive = vi.fn(() => true);

vi.mock("../../../lib/auth.js", () => ({
  getUserContext: (...args: unknown[]) => getUserContext(...args),
  isUserAccountActive: (...args: unknown[]) => isUserAccountActive(...args),
  ACCOUNT_INACTIVE_MESSAGE: "User account is not active.",
}));

vi.mock("../../../lib/rapid-iq/intel-db.js", () => ({
  listIntelOpportunities: vi.fn(async () => []),
  listIntelWatches: vi.fn(async () =>
    Array.from({ length: 68 }, (_, i) => ({ id: `watch-${i}`, market: i < 25 ? "TRANSIT" : "PSAP" })),
  ),
  seedDefaultIntelWatches: vi.fn(async () => 0),
  seedDefaultTransitWatches: vi.fn(async () => 0),
  getIntelOpportunity: vi.fn(async () => null),
  getIntelWatch: vi.fn(async () => null),
  putIntelWatch: vi.fn(),
  updateIntelOpportunityFields: vi.fn(),
  updateIntelWatchFields: vi.fn(),
}));

vi.mock("./rfp-unified-counter.js", () => ({
  getRfpCountSnapshot: vi.fn(async () => ({
    pk: "RFP_COUNTS",
    sk: "LATEST",
    entityType: "rfp_count",
    updatedAt: "2026-09-04T00:00:00.000Z",
    opportunityFeed: {
      all: 2,
      open: 2,
      psap: 2,
      campus: 0,
      venue: 0,
      hospital: 0,
      transit: 0,
      unknown: 0,
      byStatus: { new: 2, reviewed: 0, inPipeline: 0, dismissed: 0, other: 0 },
    },
    pipeline: {
      all: 1,
      open: 1,
      psap: 0,
      campus: 0,
      venue: 0,
      hospital: 0,
      transit: 1,
      unknown: 0,
      byStatus: { new: 1, reviewed: 0, inPipeline: 0, dismissed: 0, other: 0 },
    },
    intel: {
      all: 1,
      open: 1,
      psap: 0,
      campus: 1,
      venue: 0,
      hospital: 0,
      transit: 0,
      unknown: 0,
      byStatus: { new: 1, reviewed: 0, inPipeline: 0, dismissed: 0, other: 0 },
    },
    total: {
      all: 4,
      open: 4,
      psap: 2,
      campus: 1,
      venue: 0,
      hospital: 0,
      transit: 1,
      unknown: 0,
      byStatus: { new: 4, reviewed: 0, inPipeline: 0, dismissed: 0, other: 0 },
    },
  })),
}));

vi.mock("../../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    async create() {
      return undefined;
    }
  },
}));

import { handler } from "./signalHttp.js";

function makeEvent(method: string, path: string, user: UserContext | null): APIGatewayProxyEventV2 {
  getUserContext.mockResolvedValue(user);
  return {
    version: "2.0",
    routeKey: `${method} ${path}`,
    rawPath: path,
    requestContext: { http: { method, path } } as APIGatewayProxyEventV2["requestContext"],
    headers: {},
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

describe("intel HTTP RBAC", () => {
  beforeEach(() => {
    getUserContext.mockReset();
    isUserAccountActive.mockReturnValue(true);
    process.env.ENABLE_RAPID_IQ_PIPELINE = "true";
  });

  it("returns 401 when unauthenticated", async () => {
    const result = await handler(makeEvent("GET", "/api/rapid-iq/intel/opportunities", null));
    expect((result as { statusCode: number }).statusCode).toBe(401);
  });

  it("returns 403 for dispatcher", async () => {
    const result = await handler(makeEvent("GET", "/api/rapid-iq/intel/opportunities", dispatcher));
    expect((result as { statusCode: number }).statusCode).toBe(403);
  });

  it("allows rcadmin to list intel opportunities", async () => {
    const result = await handler(makeEvent("GET", "/api/rapid-iq/intel/opportunities", admin));
    expect((result as { statusCode: number }).statusCode).toBe(200);
  });

  it("allows rcadmin to read the unified RFP count snapshot", async () => {
    const result = await handler(makeEvent("GET", "/api/rapid-iq/intel/rfp-counts", admin));
    expect((result as { statusCode: number }).statusCode).toBe(200);
    const body = JSON.parse((result as { body: string }).body) as {
      snapshot: { total: { open: number } };
    };
    expect(body.snapshot.total.open).toBe(4);
  });

  it("lists watches with defaultMarket all and an uncapped total", async () => {
    const result = await handler(makeEvent("GET", "/api/rapid-iq/intel/watches", admin));
    expect((result as { statusCode: number }).statusCode).toBe(200);
    const body = JSON.parse((result as { body: string }).body) as {
      watches: unknown[];
      defaultMarket: string;
      total: number;
    };
    expect(body.defaultMarket).toBe("all");
    expect(body.total).toBe(68);
    expect(body.watches).toHaveLength(68);
  });
});
