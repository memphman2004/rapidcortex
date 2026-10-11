import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { NexiqSignalRecord } from "rapid-cortex-shared";

const findByDedupeHash = vi.fn();
const put = vi.fn();
const get = vi.fn();
const list = vi.fn();
const summary = vi.fn();
const updateStatus = vi.fn();
const upsertApollo = vi.fn();
const getUserContext = vi.fn();
const isUserAccountActive = vi.fn(() => true);
const operationalPasswordBlock = vi.fn(() => null);

vi.mock("../../repositories/nexiqSignalsRepository.js", () => ({
  NEXIQ_SIGNAL_SK: "SOURCE#civiciq",
  nexiqSignalPk: (id: string) => `SIGNAL#${id}`,
  NexiqSignalsRepository: class {
    findByDedupeHash(...args: unknown[]) {
      return findByDedupeHash(...args);
    }
    put(...args: unknown[]) {
      return put(...args);
    }
    get(...args: unknown[]) {
      return get(...args);
    }
    list(...args: unknown[]) {
      return list(...args);
    }
    summary(...args: unknown[]) {
      return summary(...args);
    }
    updateStatus(...args: unknown[]) {
      return updateStatus(...args);
    }
  },
}));

vi.mock("../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    async create() {
      return undefined;
    }
  },
}));

vi.mock("../../lib/rapid-iq/apollo-accounts.js", () => ({
  upsertApolloAccountFromSignal: (...args: unknown[]) => upsertApollo(...args),
}));

vi.mock("../../lib/auth.js", () => ({
  ACCOUNT_INACTIVE_MESSAGE: "User account is not active.",
  getUserContext: (...args: unknown[]) => getUserContext(...args),
  isUserAccountActive: (...args: unknown[]) => isUserAccountActive(...args),
}));

vi.mock("../../lib/operationalPasswordGate.js", () => ({
  operationalPasswordBlock: (...args: unknown[]) => operationalPasswordBlock(...args),
}));

vi.mock("../../lib/env.js", () => ({
  env: {
    enableNexiqSignals: true,
    nexiqSignalsTable: "rapid-cortex-nexiq-signals-test",
  },
}));

vi.mock("../../lib/correlation.js", () => ({
  withCorrelationHeaders: (_e: unknown, r: unknown) => r,
}));

const assertNexiqSignalsApiKey = vi.fn();

vi.mock("../../lib/nexiq/signals-ingest-auth.js", () => ({
  assertNexiqSignalsApiKey: (...args: unknown[]) => assertNexiqSignalsApiKey(...args),
}));

import { handler } from "./signalsHttp.js";

function baseEvent(
  partial: Partial<APIGatewayProxyEventV2> & {
    method: string;
    path: string;
    body?: string;
    iam?: boolean;
  },
): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: `${partial.method} ${partial.path}`,
    rawPath: partial.path,
    rawQueryString: "",
    headers: {},
    requestContext: {
      accountId: "1",
      apiId: "api",
      domainName: "example.com",
      domainPrefix: "api",
      http: {
        method: partial.method,
        path: partial.path,
        protocol: "HTTP/1.1",
        sourceIp: "1.1.1.1",
        userAgent: "vitest",
      },
      requestId: "req",
      routeKey: `${partial.method} ${partial.path}`,
      stage: "$default",
      time: "",
      timeEpoch: 0,
      authorizer: partial.iam
        ? { iam: { userArn: "arn:aws:iam::1:user/claude" } }
        : undefined,
    } as APIGatewayProxyEventV2["requestContext"],
    isBase64Encoded: false,
    body: partial.body,
    queryStringParameters: partial.queryStringParameters,
  } as APIGatewayProxyEventV2;
}

const validBody = {
  title: "CAD RFP — Example County",
  summary: "Procurement notice",
  sourceUrl: "https://example.gov/rfp",
  vertical: "core_psap",
  agencyName: "Example County 911",
  agencyType: "county",
  geography: { state: "TX" },
  estimatedValue: 250000,
  dueDate: "2026-12-01",
  keywords: ["cad"],
  confidenceScore: 72,
  confidenceTier: "high",
  dedupeHash: "abcdef0123456789deadbeef",
};

describe("nexiq signalsHttp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findByDedupeHash.mockResolvedValue(null);
    put.mockResolvedValue(undefined);
    assertNexiqSignalsApiKey.mockResolvedValue({ ok: false, reason: "missing_api_key" });
    getUserContext.mockResolvedValue({
      userId: "u1",
      role: "rcadmin",
      agencyId: "__platform__",
    });
  });

  it("POST without IAM or API key returns 401", async () => {
    const res = await handler(
      baseEvent({ method: "POST", path: "/api/signals", body: JSON.stringify(validBody) }),
      {} as never,
      () => undefined,
    );
    expect(res?.statusCode).toBe(401);
  });

  it("POST with ingest API key creates signal 201", async () => {
    assertNexiqSignalsApiKey.mockResolvedValue({ ok: true });
    const res = await handler(
      baseEvent({
        method: "POST",
        path: "/api/signals",
        body: JSON.stringify(validBody),
      }),
      {} as never,
      () => undefined,
    );
    expect(res?.statusCode).toBe(201);
    expect(put).toHaveBeenCalledOnce();
  });

  it("POST with IAM below threshold returns 400 below_threshold", async () => {
    const res = await handler(
      baseEvent({
        method: "POST",
        path: "/api/signals",
        iam: true,
        body: JSON.stringify({ ...validBody, confidenceScore: 20, confidenceTier: "low" }),
      }),
      {} as never,
      () => undefined,
    );
    expect(res?.statusCode).toBe(400);
    expect(JSON.parse(res?.body ?? "{}").reason).toBe("below_threshold");
  });

  it("POST with IAM duplicate returns 200 duplicate", async () => {
    findByDedupeHash.mockResolvedValue({
      signalId: "existing-1",
      dedupeHash: validBody.dedupeHash,
    } as NexiqSignalRecord);
    const res = await handler(
      baseEvent({
        method: "POST",
        path: "/api/signals",
        iam: true,
        body: JSON.stringify(validBody),
      }),
      {} as never,
      () => undefined,
    );
    expect(res?.statusCode).toBe(200);
    expect(JSON.parse(res?.body ?? "{}")).toMatchObject({
      duplicate: true,
      signalId: "existing-1",
    });
    expect(put).not.toHaveBeenCalled();
  });

  it("POST with IAM creates signal 201", async () => {
    const res = await handler(
      baseEvent({
        method: "POST",
        path: "/api/signals",
        iam: true,
        body: JSON.stringify(validBody),
      }),
      {} as never,
      () => undefined,
    );
    expect(res?.statusCode).toBe(201);
    expect(put).toHaveBeenCalledOnce();
    expect(JSON.parse(res?.body ?? "{}").signalId).toBeTruthy();
  });

  it("GET list rejects unauthorized JWT roles", async () => {
    getUserContext.mockResolvedValue({
      userId: "u1",
      role: "dispatcher",
      agencyId: "a1",
    });
    const res = await handler(
      baseEvent({ method: "GET", path: "/api/signals" }),
      {} as never,
      () => undefined,
    );
    expect(res?.statusCode).toBe(403);
  });

  it("GET list allows salescontractor", async () => {
    getUserContext.mockResolvedValue({
      userId: "u1",
      role: "salescontractor",
      agencyId: "__platform__",
    });
    list.mockResolvedValue({ items: [] });
    const res = await handler(
      baseEvent({ method: "GET", path: "/api/signals" }),
      {} as never,
      () => undefined,
    );
    expect(res?.statusCode).toBe(200);
    expect(list).toHaveBeenCalled();
  });
});
