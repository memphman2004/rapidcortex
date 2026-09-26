import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { UserContext } from "rapid-cortex-shared";

const {
  getUserContext,
  isUserAccountActive,
  putMock,
  saveMock,
  listBoardMock,
  updateMock,
  addNoteMock,
  nextTicketIdMock,
} = vi.hoisted(() => ({
  getUserContext: vi.fn(),
  isUserAccountActive: vi.fn(() => true),
  putMock: vi.fn(),
  saveMock: vi.fn(),
  listBoardMock: vi.fn(),
  updateMock: vi.fn(),
  addNoteMock: vi.fn(),
  nextTicketIdMock: vi.fn(),
}));

vi.mock("../../lib/auth.js", () => ({
  getUserContext: (...args: unknown[]) => getUserContext(...args),
  isUserAccountActive: (...args: unknown[]) => isUserAccountActive(...args),
  ACCOUNT_INACTIVE_MESSAGE: "User account is not active.",
}));

vi.mock("../../lib/operationalPasswordGate.js", () => ({
  operationalPasswordBlock: () => null,
}));

vi.mock("../../lib/env.js", () => ({
  env: {
    enableSupportForm: true,
    ticketsTable: "rc-support-tickets-test",
    supportEmail: "support@nexcortiq.us",
    supportFromEmail: "noreply@nexcortiq.us",
    supportPhone: "+1 404-555-0100",
    sesMock: true,
    auditTable: "audit-test",
  },
}));

vi.mock("../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock("../../repositories/supportTicketRepository.js", () => ({
  formatTicketId: (n: number) => `SUP-${String(n).padStart(4, "0")}`,
  SupportTicketRepository: class {
    nextTicketId = nextTicketIdMock;
    put = putMock;
    save = saveMock;
    listBoard = listBoardMock;
    update = updateMock;
    addNote = addNoteMock;
    ttlFromNow = () => 1;
  },
}));

vi.mock("@aws-sdk/client-ses", () => ({
  SESClient: class {
    send = vi.fn();
  },
  SendEmailCommand: class {},
}));

import { handler as submitHandler } from "./submit-ticket.js";
import { handler as boardHandler } from "./get-ticket-board.js";
import { handler as updateHandler } from "./update-ticket.js";
import { handler as noteHandler } from "./add-ticket-note.js";

function event(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "POST /api/support/tickets",
    rawPath: "/api/support/tickets",
    headers: {},
    isBase64Encoded: false,
    body: JSON.stringify({
      category: "bug_report",
      severity: "SEV4",
      subject: "Smoke",
      description: "Please ignore this automated test ticket.",
    }),
    requestContext: {
      http: { method: "POST", path: "/api/support/tickets" },
    } as APIGatewayProxyEventV2["requestContext"],
    ...overrides,
  } as APIGatewayProxyEventV2;
}

function parse(result: unknown): { statusCode: number; body: Record<string, unknown> } {
  const res = result as { statusCode: number; body: string };
  return { statusCode: res.statusCode, body: JSON.parse(res.body) as Record<string, unknown> };
}

const dispatcher: UserContext = {
  userId: "u-1",
  agencyId: "agency-1",
  role: "dispatcher",
  email: "disp@example.com",
  displayName: "Pat Dispatcher",
};

const rcadmin: UserContext = {
  userId: "rc-1",
  agencyId: "platform",
  role: "rcadmin",
  email: "rc@nexcortiq.us",
  displayName: "RC Admin",
};

describe("support-web handlers", () => {
  beforeEach(() => {
    getUserContext.mockReset();
    isUserAccountActive.mockReturnValue(true);
    putMock.mockReset().mockResolvedValue(undefined);
    saveMock.mockReset().mockResolvedValue(undefined);
    nextTicketIdMock.mockReset().mockResolvedValue("SUP-1001");
    listBoardMock.mockReset();
    updateMock.mockReset();
    addNoteMock.mockReset();
  });

  it("submit returns 401 when unauthenticated", async () => {
    getUserContext.mockResolvedValue(null);
    const out = parse(await submitHandler(event()));
    expect(out.statusCode).toBe(401);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("submit rejects SEV1 with 422", async () => {
    getUserContext.mockResolvedValue(dispatcher);
    const out = parse(
      await submitHandler(
        event({
          body: JSON.stringify({
            category: "technical",
            severity: "SEV1",
            subject: "Outage",
            description: "Down",
          }),
        }),
      ),
    );
    expect(out.statusCode).toBe(422);
    expect(out.body.supportPhone).toBeTruthy();
    expect(putMock).not.toHaveBeenCalled();
  });

  it("submit returns 400 on Zod failure", async () => {
    getUserContext.mockResolvedValue(dispatcher);
    const out = parse(await submitHandler(event({ body: JSON.stringify({ severity: "SEV4" }) })));
    expect(out.statusCode).toBe(400);
  });

  it("submit writes a ticket for authenticated users", async () => {
    getUserContext.mockResolvedValue(dispatcher);
    const out = parse(await submitHandler(event()));
    expect(out.statusCode).toBe(201);
    expect(out.body.ticketId).toBe("SUP-1001");
    expect(nextTicketIdMock).toHaveBeenCalledOnce();
    expect(putMock).toHaveBeenCalledOnce();
  });

  it("board returns 403 for agency roles", async () => {
    getUserContext.mockResolvedValue(dispatcher);
    const out = parse(await boardHandler(event({ rawPath: "/api/rc-internal/support-tickets/board" })));
    expect(out.statusCode).toBe(403);
    expect(listBoardMock).not.toHaveBeenCalled();
  });

  it("board returns data for RC internal operators", async () => {
    getUserContext.mockResolvedValue(rcadmin);
    listBoardMock.mockResolvedValue({ columns: { NEW: [] }, metrics: { totalOpen: 0 } });
    const out = parse(await boardHandler(event({ rawPath: "/api/rc-internal/support-tickets/board" })));
    expect(out.statusCode).toBe(200);
    expect(out.body.success).toBe(true);
  });

  it("update returns 404 when missing", async () => {
    getUserContext.mockResolvedValue(rcadmin);
    updateMock.mockResolvedValue(null);
    const out = parse(
      await updateHandler(
        event({
          pathParameters: { ticketId: "SUP-1" },
          body: JSON.stringify({ status: "OPEN" }),
        }),
      ),
    );
    expect(out.statusCode).toBe(404);
  });

  it("note returns 400 on empty text", async () => {
    getUserContext.mockResolvedValue(rcadmin);
    const out = parse(
      await noteHandler(event({ pathParameters: { ticketId: "SUP-1" }, body: JSON.stringify({ text: "" }) })),
    );
    expect(out.statusCode).toBe(400);
  });
});
