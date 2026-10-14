import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  putMock,
  getMock,
  getByTokenHashMock,
  revokeIfActiveMock,
  appendPingIfActiveMock,
  auditCreateMock,
} = vi.hoisted(() => ({
  putMock: vi.fn(),
  getMock: vi.fn(),
  getByTokenHashMock: vi.fn(),
  revokeIfActiveMock: vi.fn(),
  appendPingIfActiveMock: vi.fn(),
  auditCreateMock: vi.fn(),
}));

vi.mock("../repositories/pinpointLinkRepository.js", () => ({
  PinpointLinkRepository: class {
    put = putMock;
    get = getMock;
    getByTokenHash = getByTokenHashMock;
    revokeIfActive = revokeIfActiveMock;
    appendPingIfActive = appendPingIfActiveMock;
  },
}));

vi.mock("../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = auditCreateMock;
  },
}));

vi.mock("../repositories/incidentRepository.js", () => ({
  IncidentRepository: class {},
}));

vi.mock("../lib/incidentReadAccess.js", () => ({
  resolveIncidentRead: vi.fn(),
}));

vi.mock("./sms/smsProviderFactory.js", () => ({
  sendIncidentMediaLinkSms: vi.fn(),
}));

import { createHash } from "node:crypto";
import { env } from "../lib/env.js";
import { PinpointService } from "./pinpointService.js";

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

const TOKEN = "test-opaque-token-abcdefghijklmnop";
const BASE_ROW = {
  linkId: "ppl_1",
  tokenHash: hashToken(TOKEN),
  agencyId: "agency-a",
  incidentId: "inc_1",
  status: "active" as const,
  createdAt: "2026-10-14T11:00:00.000Z",
  updatedAt: "2026-10-14T11:00:00.000Z",
  expiresAt: "2026-10-14T13:00:00.000Z",
  pings: [] as Array<{ capturedAt: string; lat: number; lng: number }>,
  callerPhoneE164: "+15551234567",
  channel: "browser" as const,
  consentGrantedAt: "2026-10-14T11:00:00.000Z",
  smsSentAt: null,
  smsProviderRef: null,
  ttl: 9999999999,
};

describe("PinpointService.revokeByToken + capture after revoke", () => {
  beforeEach(() => {
    putMock.mockReset();
    getMock.mockReset();
    getByTokenHashMock.mockReset();
    revokeIfActiveMock.mockReset();
    appendPingIfActiveMock.mockReset();
    auditCreateMock.mockReset();
    putMock.mockImplementation(async (item: unknown) => item);
    auditCreateMock.mockResolvedValue(undefined);
    env.enablePinpoint = true;
    env.pinpointLinksTable = "pinpoint-links-table";
    env.pinpointPublicBaseUrl = "https://app.example.test";
  });

  it("revokes an active session and audits caller_stop", async () => {
    getByTokenHashMock.mockResolvedValue({ ...BASE_ROW });
    revokeIfActiveMock.mockResolvedValue("revoked");
    const svc = new PinpointService();
    const out = await svc.revokeByToken(TOKEN, { reason: "caller_stop" });
    expect(out).toEqual({ ok: true, alreadyEnded: false });
    expect(revokeIfActiveMock).toHaveBeenCalledWith(
      "ppl_1",
      expect.objectContaining({
        revokedReason: "caller_stop",
        revokedBy: "caller:token",
      }),
    );
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: "agency-a",
        incidentId: "inc_1",
        actorId: "caller:token",
        details: expect.objectContaining({
          reason: "caller_stop",
          actorRole: "caller",
          outcome: "revoked",
        }),
      }),
    );
  });

  it("is idempotent when already revoked", async () => {
    getByTokenHashMock.mockResolvedValue({ ...BASE_ROW, status: "revoked" });
    const svc = new PinpointService();
    const out = await svc.revokeByToken(TOKEN, { reason: "caller_stop" });
    expect(out).toEqual({ ok: true, alreadyEnded: true });
    expect(revokeIfActiveMock).not.toHaveBeenCalled();
    expect(auditCreateMock).toHaveBeenCalled();
  });

  it("treats concurrent revokeIfActive already_ended as success", async () => {
    getByTokenHashMock.mockResolvedValue({ ...BASE_ROW });
    revokeIfActiveMock.mockResolvedValue("already_ended");
    const svc = new PinpointService();
    const out = await svc.revokeByToken(TOKEN, { reason: "browser_interrupt" });
    expect(out).toEqual({ ok: true, alreadyEnded: true });
  });

  it("rejects location uploads after revoke with SESSION_REVOKED", async () => {
    getByTokenHashMock.mockResolvedValue({ ...BASE_ROW, status: "revoked" });
    const svc = new PinpointService();
    await expect(
      svc.captureLocation(TOKEN, { lat: 1, lng: 2, accuracyM: 15 }),
    ).rejects.toThrow("SESSION_REVOKED");
    expect(appendPingIfActiveMock).not.toHaveBeenCalled();
  });

  it("rejects concurrent location update when revoke wins (appendPingIfActive session_ended)", async () => {
    // Caller still sees an active row at read time, but conditional append loses to revoke.
    getByTokenHashMock.mockResolvedValue({ ...BASE_ROW, status: "active", pings: [] });
    appendPingIfActiveMock.mockResolvedValue("session_ended");
    getMock.mockResolvedValue({ ...BASE_ROW, status: "revoked" });
    const svc = new PinpointService();
    await expect(
      svc.captureLocation(TOKEN, { lat: 33.1, lng: -84.2, accuracyM: 12 }),
    ).rejects.toThrow("SESSION_REVOKED");
    expect(appendPingIfActiveMock).toHaveBeenCalled();
  });

  it("under concurrent revoke + capture, only revoke keeps the session ended", async () => {
    getByTokenHashMock
      .mockResolvedValueOnce({ ...BASE_ROW }) // revoke read
      .mockResolvedValueOnce({ ...BASE_ROW, status: "active", pings: [] }); // capture read before append
    revokeIfActiveMock.mockResolvedValue("revoked");
    appendPingIfActiveMock.mockResolvedValue("session_ended");
    getMock.mockResolvedValue({ ...BASE_ROW, status: "revoked" });
    const svc = new PinpointService();
    const [revokeOut, captureOutcome] = await Promise.all([
      svc.revokeByToken(TOKEN, { reason: "caller_stop" }),
      svc.captureLocation(TOKEN, { lat: 1, lng: 2, accuracyM: 10 }).then(
        () => ({ ok: true as const }),
        (err: unknown) => ({
          ok: false as const,
          message: err instanceof Error ? err.message : String(err),
        }),
      ),
    ]);
    expect(revokeOut).toEqual({ ok: true, alreadyEnded: false });
    expect(captureOutcome.ok).toBe(false);
    if (!captureOutcome.ok) {
      expect(captureOutcome.message).toMatch(/SESSION_REVOKED|SESSION_EXPIRED/);
    }
  });

  it("rejects location uploads when the link is expired", async () => {
    getByTokenHashMock.mockResolvedValue({
      ...BASE_ROW,
      status: "active",
      expiresAt: "2020-01-01T00:00:00.000Z",
    });
    const svc = new PinpointService();
    await expect(
      svc.captureLocation(TOKEN, { lat: 1, lng: 2, accuracyM: 15 }),
    ).rejects.toThrow("SESSION_EXPIRED");
    expect(appendPingIfActiveMock).not.toHaveBeenCalled();
  });

  it("rejects rate-limited capture when conditional append fails", async () => {
    getByTokenHashMock.mockResolvedValue({ ...BASE_ROW, pings: [] });
    appendPingIfActiveMock.mockResolvedValue("rate_limited");
    const svc = new PinpointService();
    await expect(
      svc.captureLocation(TOKEN, { lat: 1.1, lng: 2.1, accuracyM: 15 }),
    ).rejects.toThrow(/wait before sending/i);
  });
});

describe("PinpointService.getDispatcherLink tenancy", () => {
  beforeEach(() => {
    getMock.mockReset();
    auditCreateMock.mockReset();
    env.enablePinpoint = true;
    env.pinpointLinksTable = "pinpoint-links-table";
  });

  it("hides links from a different agency (cross-tenant)", async () => {
    const { resolveIncidentRead } = await import("../lib/incidentReadAccess.js");
    vi.mocked(resolveIncidentRead).mockResolvedValue({
      incident: {
        incidentId: "inc_1",
        agencyId: "agency-a",
      },
    } as never);
    getMock.mockResolvedValue({ ...BASE_ROW, agencyId: "agency-b" });
    const svc = new PinpointService();
    await expect(
      svc.getDispatcherLink("inc_1", "ppl_1", {
        userId: "u1",
        agencyId: "agency-a",
        role: "dispatcher",
      } as never),
    ).rejects.toThrow("NOT_FOUND");
  });
});
