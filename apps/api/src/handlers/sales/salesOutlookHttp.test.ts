import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getUserContext,
  isUserAccountActive,
  operationalPasswordBlock,
  getUserOutlookConnection,
  putUserOutlookConnection,
  deleteUserOutlookConnection,
  sendOutlookMail,
  ensureOutlookAccessToken,
  exchangePersonalOutlookAuthCode,
  buildPersonalOutlookAuthorizeUrl,
  resolveOutlookClientSecret,
  signOutlookOAuthState,
  verifyOutlookOAuthState,
  encryptOutlookToken,
  isOutlookGraphMock,
  isOutlookOAuthConfigured,
  auditCreate,
} = vi.hoisted(() => ({
  getUserContext: vi.fn(),
  isUserAccountActive: vi.fn(() => true),
  operationalPasswordBlock: vi.fn(() => null),
  getUserOutlookConnection: vi.fn(),
  putUserOutlookConnection: vi.fn(),
  deleteUserOutlookConnection: vi.fn(),
  sendOutlookMail: vi.fn(),
  ensureOutlookAccessToken: vi.fn(),
  exchangePersonalOutlookAuthCode: vi.fn(),
  buildPersonalOutlookAuthorizeUrl: vi.fn(() => "https://login.example/authorize"),
  resolveOutlookClientSecret: vi.fn(async () => "secret"),
  signOutlookOAuthState: vi.fn(() => "state.sig"),
  verifyOutlookOAuthState: vi.fn(() => ({ userId: "u1" })),
  encryptOutlookToken: vi.fn(async (v: string) => `enc:${v}`),
  isOutlookGraphMock: vi.fn(() => false),
  isOutlookOAuthConfigured: vi.fn(() => true),
  auditCreate: vi.fn(async () => undefined),
}));

vi.mock("../../lib/auth.js", () => ({
  getUserContext,
  isUserAccountActive,
  ACCOUNT_INACTIVE_MESSAGE: "inactive",
}));
vi.mock("../../lib/operationalPasswordGate.js", () => ({
  operationalPasswordBlock,
}));
vi.mock("../../lib/env.js", () => ({
  env: { enableSalesTools: true },
}));
vi.mock("../../lib/rapid-iq/sales-automation-db.js", () => ({
  getUserOutlookConnection,
  putUserOutlookConnection,
  deleteUserOutlookConnection,
}));
vi.mock("../../lib/rapid-iq/outlook-graph.js", () => ({
  buildPersonalOutlookAuthorizeUrl,
  encryptOutlookToken,
  ensureOutlookAccessToken,
  exchangePersonalOutlookAuthCode,
  isOutlookGraphMock,
  isOutlookOAuthConfigured,
  resolveOutlookClientSecret,
  sendOutlookMail,
  signOutlookOAuthState,
  verifyOutlookOAuthState,
}));
vi.mock("../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = auditCreate;
  },
}));
vi.mock("../../lib/correlation.js", () => ({
  withCorrelationHeaders: (_e: unknown, r: unknown) => r,
}));
vi.mock("../../lib/ids.js", () => ({ makeId: () => "audit-1" }));

import { handler } from "./salesOutlookHttp.js";

function event(method: string, path: string, body?: unknown) {
  return {
    rawPath: path,
    body: body ? JSON.stringify(body) : undefined,
    requestContext: { http: { method, path } },
  } as never;
}

describe("salesOutlookHttp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserContext.mockResolvedValue({
      userId: "u1",
      role: "salescontractor",
      email: "rep@nexcortiq.us",
    });
    isUserAccountActive.mockReturnValue(true);
    operationalPasswordBlock.mockReturnValue(null);
    isOutlookGraphMock.mockReturnValue(false);
    isOutlookOAuthConfigured.mockReturnValue(true);
    verifyOutlookOAuthState.mockReturnValue({ userId: "u1" });
  });

  it("forbids dispatcher", async () => {
    getUserContext.mockResolvedValue({ userId: "u1", role: "dispatcher", email: "d@x.gov" });
    const res = await handler(event("GET", "/api/sales/outlook/status"), {} as never, {} as never);
    expect(res && "statusCode" in res ? res.statusCode : 0).toBe(403);
  });

  it("returns authorize URL on connect", async () => {
    const res = await handler(event("GET", "/api/sales/outlook/connect"), {} as never, {} as never);
    expect(res && "statusCode" in res ? res.statusCode : 0).toBe(200);
    const body = JSON.parse(String(res && "body" in res ? res.body : "{}"));
    expect(body.authorizeUrl).toContain("https://login.example/authorize");
  });

  it("rejects callback when state user mismatches", async () => {
    verifyOutlookOAuthState.mockReturnValue({ userId: "other" });
    const res = await handler(
      event("POST", "/api/sales/outlook/callback", { code: "c", state: "s" }),
      {} as never,
      {} as never,
    );
    expect(res && "statusCode" in res ? res.statusCode : 0).toBe(403);
  });

  it("requires connection before send", async () => {
    getUserOutlookConnection.mockResolvedValue(null);
    const res = await handler(
      event("POST", "/api/sales/send-email", {
        to: "a@b.co",
        subject: "Hi",
        body: "Hello there",
      }),
      {} as never,
      {} as never,
    );
    expect(res && "statusCode" in res ? res.statusCode : 0).toBe(400);
  });

  it("sends via Graph when connected", async () => {
    getUserOutlookConnection.mockResolvedValue({
      agencyId: "platform",
      userId: "u1",
      mailbox: "rep@nexcortiq.us",
      mock: false,
      refreshTokenEnc: "enc:r",
      connectedBy: "u1",
      connectedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    ensureOutlookAccessToken.mockResolvedValue({ accessToken: "tok" });
    sendOutlookMail.mockResolvedValue(undefined);
    const res = await handler(
      event("POST", "/api/sales/send-email", {
        to: "director@agency.gov",
        subject: "Hi",
        body: "Hello there",
      }),
      {} as never,
      {} as never,
    );
    expect(res && "statusCode" in res ? res.statusCode : 0).toBe(200);
    expect(sendOutlookMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "director@agency.gov",
        fromMailbox: "rep@nexcortiq.us",
      }),
    );
  });
});
