import { beforeEach, describe, expect, it, vi } from "vitest";
import { invokeHttpHandler, makeAuthenticatedEvent } from "../handlerTestUtils.js";

const { getRelationship, putEscalation } = vi.hoisted(() => ({
  getRelationship: vi.fn(),
  putEscalation: vi.fn(),
}));

vi.mock("../../lib/escalation/escalation-db.js", () => ({
  getRelationship,
  putEscalation,
  getEscalation: vi.fn(),
  getEscalationByViewerToken: vi.fn(),
  listAuditEvents: vi.fn(),
  listEscalationsBySource: vi.fn(),
  listEscalationsByTarget: vi.fn(),
  recordViewerAccess: vi.fn(),
  updateEscalationStatus: vi.fn(),
  putRelationship: vi.fn(),
  appendAuditEvent: vi.fn(),
}));

vi.mock("../../lib/escalation/fan-out-push.js", () => ({
  fanOutEscalationPush: vi.fn(),
}));

vi.mock("../../lib/escalation/external-escalation.js", () => ({
  triggerExternalEscalation: vi.fn(),
}));

vi.mock("../../repositories/agencyRepository.js", () => ({
  AgencyRepository: class {
    get = vi.fn();
  },
}));

vi.mock("../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = vi.fn();
  },
}));

import { handler } from "./escalationHttp.js";

function createEvent(opts: { role: string; body?: string }) {
  return makeAuthenticatedEvent({
    role: opts.role,
    agencyId: "agency-a",
    email: `${opts.role}@agency-a.example`,
    rawPath: "/api/escalations",
    routeKey: "POST /api/escalations",
    body: opts.body,
  });
}

describe("escalationHttp create", () => {
  beforeEach(() => {
    getRelationship.mockReset();
    putEscalation.mockReset();
  });

  it("returns 403 when the role cannot escalate", async () => {
    const res = await invokeHttpHandler(
      handler,
      createEvent({
        role: "auditor",
        body: JSON.stringify({
          incidentId: "inc-1",
          incidentType: "Assault",
          incidentDescription: "Fight in section A",
          incidentLocation: { description: "Section A" },
        }),
      }),
    );
    expect(res.statusCode).toBe(403);
    expect(putEscalation).not.toHaveBeenCalled();
    expect(getRelationship).not.toHaveBeenCalled();
  });

  it("returns 400 when the body fails Zod validation", async () => {
    const res = await invokeHttpHandler(
      handler,
      createEvent({
        role: "VENUE_SECURITY",
        body: JSON.stringify({}),
      }),
    );
    expect(res.statusCode).toBe(400);
    const parsed = JSON.parse(res.body ?? "{}") as { error?: string };
    expect(parsed.error).toBeTruthy();
    expect(putEscalation).not.toHaveBeenCalled();
  });
});
