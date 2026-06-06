import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPremiseNoteRequestSchema } from "rapid-cortex-shared";

const mockCreatePremise = vi.hoisted(() => vi.fn());
const mockAuditCreate = vi.hoisted(() => vi.fn());

vi.mock("../../services/callerCardService.js", () => ({
  CallerCardService: class {
    createPremiseNote = mockCreatePremise;
  },
}));

vi.mock("../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = mockAuditCreate;
  },
}));

import { handler } from "./createPremiseNote.js";
import { invokeHttpHandler, makeAuthenticatedEvent } from "../handlerTestUtils.js";

describe("createPremiseNote handler", () => {
  it("Zod rejects empty text", () => {
    const p = createPremiseNoteRequestSchema.safeParse({ text: "" });
    expect(p.success).toBe(false);
  });

  beforeEach(() => {
    mockCreatePremise.mockReset();
    mockAuditCreate.mockReset();
  });

  it("rejects invalid body", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        pathParameters: { id: "inc-1" },
        body: JSON.stringify({ text: "" }),
        rawPath: "/api/incidents/inc-1/premise-notes",
        routeKey: "POST /api/incidents/{id}/premise-notes",
      }),
    );
    expect(res.statusCode).toBe(400);
  });

  it("creates note and audits", async () => {
    mockCreatePremise.mockResolvedValue({
      note: {
        noteId: "pnm-1",
        agencyId: "agency-a",
        normalizedAddress: "a",
        incidentId: "inc-1",
        text: "Hello",
        createdBy: "test-user",
        createdAt: "2025-01-01T00:00:00.000Z",
      },
    });
    mockAuditCreate.mockResolvedValue(undefined);

    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        pathParameters: { id: "inc-1" },
        body: JSON.stringify({ text: "Hello" }),
        rawPath: "/api/incidents/inc-1/premise-notes",
        routeKey: "POST /api/incidents/{id}/premise-notes",
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(mockAuditCreate).toHaveBeenCalled();
  });
});
