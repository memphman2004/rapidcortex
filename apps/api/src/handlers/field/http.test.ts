import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  putAccessRequest,
  notifyAccessRequest,
  auditCreate,
  listIncidents,
  getIncident,
} = vi.hoisted(() => ({
  putAccessRequest: vi.fn(),
  notifyAccessRequest: vi.fn(),
  auditCreate: vi.fn(),
  listIncidents: vi.fn(),
  getIncident: vi.fn(),
}));

vi.mock("../../field/store.js", () => ({
  fieldCommandStore: {
    putAccessRequest,
    putContinuityLog: vi.fn(),
    listContinuityLogs: vi.fn(),
    putCoachingNote: vi.fn(),
    putMessage: vi.fn(),
    putQaFlag: vi.fn(),
    putFollow: vi.fn(),
  },
}));

vi.mock("../../field/notify.js", () => ({
  notifyAccessRequest,
}));

vi.mock("../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = auditCreate;
  },
}));

vi.mock("../../services/incidentService.js", () => ({
  IncidentService: class {
    list = listIncidents;
    get = getIncident;
  },
}));

vi.mock("../../services/transcriptService.js", () => ({
  TranscriptService: class {
    list = vi.fn();
  },
}));

vi.mock("../../services/incidentTimelineService.js", () => ({
  IncidentTimelineService: class {
    addNote = vi.fn();
  },
}));

vi.mock("../../repositories/websocketConnectionRepository.js", () => ({
  WebSocketConnectionRepository: class {
    listByAgencyId = vi.fn(async () => []);
  },
}));

vi.mock("../../repositories/activeCallRepository.js", () => ({
  ActiveCallRepository: class {
    listByAgency = vi.fn(async () => []);
  },
}));

import { handler } from "./http.js";
import { invokeHttpHandler, makeAuthenticatedEvent, makeUnauthenticatedEvent } from "../handlerTestUtils.js";

describe("field command / access-requests", () => {
  beforeEach(() => {
    putAccessRequest.mockReset();
    notifyAccessRequest.mockReset();
    auditCreate.mockReset();
    listIncidents.mockReset();
    getIncident.mockReset();
    listIncidents.mockResolvedValue([]);
    putAccessRequest.mockResolvedValue({
      requestId: "far_1",
      agencyId: "uga",
      requestedWorkspace: "911-dispatch",
      requestedWorkspaceTitle: "911 Dispatch",
      userEmail: "campus@uga.edu",
      userId: "user-1",
      role: "campus_admin",
      reason: "I cover both",
      createdAt: "2026-09-07T00:00:00.000Z",
      sk: "ACCESS#x",
      itemType: "ACCESS_REQUEST",
    });
    notifyAccessRequest.mockResolvedValue({ notified: true });
    auditCreate.mockResolvedValue(undefined);
  });

  it("rejects unauthenticated access requests", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeUnauthenticatedEvent({
        routeKey: "POST /api/access-requests",
        rawPath: "/api/access-requests",
        body: JSON.stringify({ requestedWorkspace: "911-dispatch" }),
      }),
    );
    expect(res.statusCode).toBe(401);
  });

  it("scopes the request to JWT agencyId and ignores a forged body agencyId", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "campus_admin",
        agencyId: "uga",
        userId: "user-1",
        email: "campus@uga.edu",
        routeKey: "POST /api/access-requests",
        rawPath: "/api/access-requests",
        body: JSON.stringify({
          requestedWorkspace: "911-dispatch",
          requestedWorkspaceTitle: "911 Dispatch",
          agencyId: "other-agency",
          userEmail: "attacker@example.com",
          reason: "I cover both",
        }),
      }),
    );
    expect(res.statusCode).toBe(201);
    expect(putAccessRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: "uga",
        userEmail: "campus@uga.edu",
        requestedWorkspace: "dispatch_ops",
      }),
    );
    const stored = putAccessRequest.mock.calls[0]?.[0] as { agencyId: string; userEmail: string };
    expect(stored.agencyId).not.toBe("other-agency");
    expect(stored.userEmail).not.toBe("attacker@example.com");
  });

  it("forbids Command home for hospital staff", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "hospitalstaff",
        agencyId: "hosp-1",
        routeKey: "GET /api/field/command/home",
        rawPath: "/api/field/command/home",
      }),
    );
    expect(res.statusCode).toBe(403);
  });

  it("forbids Command home for campus_admin even though they inherit some PSAP perms", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "campus_admin",
        agencyId: "uga",
        routeKey: "GET /api/field/command/home",
        rawPath: "/api/field/command/home",
      }),
    );
    expect(res.statusCode).toBe(403);
    expect(listIncidents).not.toHaveBeenCalled();
  });

  it("lets a leftover commsupervisor JWT load Command home as supervisor", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "commsupervisor",
        agencyId: "kcpd",
        routeKey: "GET /api/field/command/home",
        rawPath: "/api/field/command/home",
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(listIncidents).toHaveBeenCalled();
  });

  it("rejects requesting a tool the role already has", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "campus_admin",
        agencyId: "uga",
        email: "campus@uga.edu",
        routeKey: "POST /api/access-requests",
        rawPath: "/api/access-requests",
        body: JSON.stringify({ requestedWorkspace: "campus" }),
      }),
    );
    expect(res.statusCode).toBe(400);
    expect(putAccessRequest).not.toHaveBeenCalled();
  });
});
