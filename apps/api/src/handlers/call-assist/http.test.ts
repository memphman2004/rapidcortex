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
    listExternal: vi.fn(async () => []),
    putExternal: vi.fn(),
    deleteExternal: vi.fn(),
    listKnowledge: vi.fn(async () => []),
    putKnowledge: vi.fn(),
    deleteKnowledge: vi.fn(),
    listRecordsRequests: vi.fn(async () => []),
    putRecordsRequest: vi.fn(),
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
    listSessions.mockResolvedValue([{ sessionId: "s1", agencyId: "kcpd" }]);
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
});
