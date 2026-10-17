import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserContext, isUserAccountActive, listSessions, assertCanPerform, canDispatch } = vi.hoisted(() => ({
  getUserContext: vi.fn(),
  isUserAccountActive: vi.fn(),
  listSessions: vi.fn(),
  assertCanPerform: vi.fn(),
  canDispatch: vi.fn(),
}));

vi.mock("../lib/auth.js", () => ({
  ACCOUNT_INACTIVE_MESSAGE: "inactive",
  getUserContext,
  isUserAccountActive,
}));

vi.mock("../lib/env.js", () => ({
  env: { enablePreArrivalIq: true },
}));

vi.mock("../pre-arrival/preArrivalService.js", () => ({
  preArrivalService: {
    listSessions,
    createSession: vi.fn(),
    getDispatcherSession: vi.fn(),
    endSession: vi.fn(),
  },
}));

vi.mock("../pre-arrival/eta/eta-notification-handler.js", () => ({
  processEtaEvent: vi.fn(),
}));

vi.mock("rapid-cortex-security", () => ({
  AuthorizationService: class {
    assertCanPerform = assertCanPerform;
    canDispatch = canDispatch;
  },
}));

import { handler } from "./preArrivalIncidentsHttp.js";

describe("preArrivalIncidentsHttp authz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isUserAccountActive.mockReturnValue(true);
    assertCanPerform.mockImplementation(() => undefined);
    canDispatch.mockReturnValue(true);
  });

  it("returns 401 when unauthenticated", async () => {
    getUserContext.mockResolvedValue(null);
    const res = await handler(
      {
        routeKey: "GET /api/incidents/{id}/pre-arrival/sessions",
        pathParameters: { id: "inc-1" },
      } as never,
      {} as never,
      () => undefined,
    );
    expect(res?.statusCode).toBe(401);
  });

  it("returns 403 for auditor role", async () => {
    getUserContext.mockResolvedValue({
      userId: "u1",
      agencyId: "ag-1",
      role: "auditor",
    });
    canDispatch.mockReturnValue(true);
    const res = await handler(
      {
        routeKey: "GET /api/incidents/{id}/pre-arrival/sessions",
        pathParameters: { id: "inc-1" },
      } as never,
      {} as never,
      () => undefined,
    );
    expect(res?.statusCode).toBe(403);
  });

  it("scopes listSessions to caller agencyId", async () => {
    getUserContext.mockResolvedValue({
      userId: "u1",
      agencyId: "ag-1",
      role: "dispatcher",
    });
    listSessions.mockResolvedValue([]);
    const res = await handler(
      {
        routeKey: "GET /api/incidents/{id}/pre-arrival/sessions",
        pathParameters: { id: "inc-1" },
      } as never,
      {} as never,
      () => undefined,
    );
    expect(res?.statusCode).toBe(200);
    expect(listSessions).toHaveBeenCalledWith("inc-1", "ag-1");
  });
});
