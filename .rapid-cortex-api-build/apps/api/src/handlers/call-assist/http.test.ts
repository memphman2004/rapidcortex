import { beforeEach, describe, expect, it, vi } from "vitest";

const { listSessions, getSession } = vi.hoisted(() => ({
  listSessions: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("../../call-assist/store.js", () => ({
  callAssistStore: {
    listSessions,
    getSession,
    getShift: vi.fn(async () => null),
    putShift: vi.fn(),
    putSession: vi.fn(),
    putSurvey: vi.fn(),
    listSurveys: vi.fn(async () => []),
    listTenantConfigs: vi.fn(async () => []),
    getConfig: vi.fn(async () => null),
    putConfig: vi.fn(),
    enqueueRebuild: vi.fn(),
    listExternal: vi.fn(async () => []),
    putExternal: vi.fn(),
    deleteExternal: vi.fn(),
    listKnowledge: vi.fn(async () => []),
    listAllKnowledge: vi.fn(async () => []),
    getKnowledge: vi.fn(async () => null),
    putKnowledge: vi.fn(async (row) => row),
    deleteKnowledge: vi.fn(),
    listRecordsRequests: vi.fn(async () => []),
    putRecordsRequest: vi.fn(),
    listCallbacks: vi.fn(async () => []),
    putCallback: vi.fn(),
    listDueCallbacks: vi.fn(async () => []),
    listQaReviews: vi.fn(async () => []),
    getQaReview: vi.fn(async () => null),
    putQaReview: vi.fn(),
    listPrompts: vi.fn(async () => []),
    getPrompt: vi.fn(async () => null),
    putPrompt: vi.fn(),
    listTransfers: vi.fn(async () => []),
    putTransfer: vi.fn(),
    listPromptProposals: vi.fn(async () => []),
    getPromptProposal: vi.fn(async () => null),
    putPromptProposal: vi.fn(),
    deleteSurvey: vi.fn(),
    getSelfServiceToken: vi.fn(async () => null),
    putSelfServiceToken: vi.fn(),
  },
}));

vi.mock("../../call-assist/config-service.js", () => ({
  getOrCreateConfig: vi.fn(async (agencyId: string) => ({ agencyId })),
  isWithinOperatingHours: vi.fn(() => true),
  patchConfig: vi.fn(),
  CALL_ASSIST_SHIFT_TTL_MS: 8 * 60 * 60 * 1000,
}));

vi.mock("../../call-assist/build-ui-profile.js", () => ({
  loadCallAssistUiProfile: vi.fn(async (_user: unknown, agencyId: string) => ({
    agencyId,
    shortName: agencyId,
  })),
}));

vi.mock("../../middleware/requireAddon.js", () => ({
  requireAddon: () => async () => null,
}));

vi.mock("../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = vi.fn();
  },
}));

vi.mock("../../lib/env.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../lib/env.js")>();
  return {
    env: {
      ...mod.env,
      enableCallAssist: true,
      callAssistTable: "test-call-assist",
    },
  };
});

import { handler } from "./http.js";
import { invokeHttpHandler, makeAuthenticatedEvent } from "../handlerTestUtils.js";

describe("call-assist tenant override", () => {
  beforeEach(() => {
    listSessions.mockReset();
    getSession.mockReset();
    listSessions.mockResolvedValue([{ sessionId: "s1", agencyId: "kcpd", createdAt: "2026-09-01T00:00:00.000Z", intake: {} }]);
  });

  it("lets RC operators scope sessions with ?agencyId=", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "rcsuperadmin",
        agencyId: "__platform__",
        routeKey: "GET /api/call-assist/sessions",
        rawPath: "/api/call-assist/sessions",
        queryStringParameters: { agencyId: "kcpd" },
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(listSessions).toHaveBeenCalledWith("kcpd", true, 100);
  });

  it("rejects ?agencyId= for dispatchers instead of silently switching tenants", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "kcpd",
        routeKey: "GET /api/call-assist/sessions",
        rawPath: "/api/call-assist/sessions",
        queryStringParameters: { agencyId: "uga-campus" },
      }),
    );
    expect(res.statusCode).toBe(403);
    expect(listSessions).not.toHaveBeenCalled();
  });

  it("returns config scoped to the JWT agencyId", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "kcpd",
        routeKey: "GET /api/call-assist/config",
        rawPath: "/api/call-assist/config",
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(String(res.body ?? "{}")) as { agencyId?: string; config?: { agencyId?: string } };
    expect(body.agencyId).toBe("kcpd");
    expect(body.config?.agencyId).toBe("kcpd");
  });

  it("asks RC operators to select an agency when JWT is the platform sentinel", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "rcadmin",
        agencyId: "__platform__",
        routeKey: "GET /api/call-assist/sessions",
        rawPath: "/api/call-assist/sessions",
      }),
    );
    expect(res.statusCode).toBe(400);
    expect(listSessions).not.toHaveBeenCalled();
  });

  it("lets RC operators list the Lex bot fleet without selecting an agency", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "rcsuperadmin",
        agencyId: "__platform__",
        routeKey: "GET /api/call-assist/bots",
        rawPath: "/api/call-assist/bots",
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(String(res.body ?? "{}")) as { templateVersion?: string; quota?: { limit?: number } };
    expect(body.templateVersion).toBeTruthy();
    expect(body.quota?.limit).toBeGreaterThan(0);
  });

  it("forbids agencyadmin from Lex bot fleet management", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "agencyadmin",
        agencyId: "kcpd",
        routeKey: "GET /api/call-assist/bots",
        rawPath: "/api/call-assist/bots",
      }),
    );
    expect(res.statusCode).toBe(403);
  });
});

describe("call-assist P2 RBAC", () => {
  it("forbids dispatcher from prompt CMS and retention", async () => {
    const prompts = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "kcpd",
        routeKey: "GET /api/call-assist/prompts",
        rawPath: "/api/call-assist/prompts",
      }),
    );
    expect(prompts.statusCode).toBe(403);
    const retention = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "kcpd",
        routeKey: "PATCH /api/call-assist/retention",
        rawPath: "/api/call-assist/retention",
        body: JSON.stringify({ audioRetentionDays: 30 }),
      }),
    );
    expect(retention.statusCode).toBe(403);
  });

  it("lets supervisor view Call Assist QA and analytics dashboards", async () => {
    const qa = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "supervisor",
        agencyId: "kcpd",
        routeKey: "GET /api/call-assist/qa/dashboard",
        rawPath: "/api/call-assist/qa/dashboard",
      }),
    );
    expect(qa.statusCode).toBe(200);
    const analytics = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "supervisor",
        agencyId: "kcpd",
        routeKey: "GET /api/call-assist/analytics/dashboard",
        rawPath: "/api/call-assist/analytics/dashboard",
      }),
    );
    expect(analytics.statusCode).toBe(200);
    const body = JSON.parse(String(analytics.body ?? "{}")) as { dashboard?: { window?: { sessionCount?: number } } };
    expect(body.dashboard?.window).toBeTruthy();
  });

  it("lets agencyadmin read prompt CMS", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "agencyadmin",
        agencyId: "kcpd",
        routeKey: "GET /api/call-assist/prompts",
        rawPath: "/api/call-assist/prompts",
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(String(res.body ?? "{}")) as { items?: unknown[] };
    expect(Array.isArray(body.items)).toBe(true);
  });

  it("lets dispatcher read the callback queue", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "kcpd",
        routeKey: "GET /api/call-assist/callbacks/queue",
        rawPath: "/api/call-assist/callbacks/queue",
      }),
    );
    expect(res.statusCode).toBe(200);
  });
});

describe("call-assist P3 RBAC", () => {
  it("forbids dispatcher from prompt proposal queue and QA prompt propose", async () => {
    const proposals = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "kcpd",
        routeKey: "GET /api/call-assist/prompt-proposals",
        rawPath: "/api/call-assist/prompt-proposals",
      }),
    );
    expect(proposals.statusCode).toBe(403);
    const propose = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "kcpd",
        routeKey: "POST /api/call-assist/sessions/{sessionId}/qa/propose-prompt",
        rawPath: "/api/call-assist/sessions/s1/qa/propose-prompt",
        body: JSON.stringify({ findingSummary: "Missed disclosure" }),
      }),
    );
    expect(propose.statusCode).toBe(403);
  });

  it("lets agencyadmin list prompt proposals", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "agencyadmin",
        agencyId: "kcpd",
        routeKey: "GET /api/call-assist/prompt-proposals",
        rawPath: "/api/call-assist/prompt-proposals",
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(String(res.body ?? "{}")) as { items?: unknown[] };
    expect(Array.isArray(body.items)).toBe(true);
  });

  it("lets dispatcher read a session transfer ledger", async () => {
    getSession.mockResolvedValue({ sessionId: "s1", agencyId: "kcpd", lastTransferOutcome: "INITIATED" });
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "kcpd",
        routeKey: "GET /api/call-assist/sessions/{sessionId}/transfers",
        rawPath: "/api/call-assist/sessions/s1/transfers",
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(String(res.body ?? "{}")) as { lastOutcome?: string; items?: unknown[] };
    expect(body.lastOutcome).toBe("INITIATED");
    expect(Array.isArray(body.items)).toBe(true);
  });
});
